import json
import boto3
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List

# AWS Services
bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')
sagemaker = boto3.client('sagemaker-runtime', region_name='us-west-2')
dynamodb = boto3.resource('dynamodb')

# Environment variables
SAGEMAKER_ENDPOINT = os.environ['SAGEMAKER_ENDPOINT']
TABLE_NAME = os.environ['DYNAMODB_TABLE_NAME']

def lambda_handler(event, context):
    """
    Lambda function to classify activity and generate AI feedback
    """
    try:
        # Parse the request body
        body = json.loads(event['body']) if isinstance(event.get('body'), str) else event.get('body', {})
        
        # Get recent activity context
        user_id = body.get('user_id', 'anonymous')
        recent_context = get_recent_context(user_id)
        
        # Get SageMaker pre-score
        pre_score = get_sagemaker_score(body, recent_context)
        
        # Generate AI response with Bedrock
        ai_response = generate_ai_response(body, recent_context, pre_score)
        
        # Store result in DynamoDB
        store_classification_result(user_id, body, ai_response)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(ai_response)
        }
        
    except Exception as e:
        print(f"Error classifying activity: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Internal server error'})
        }

def get_recent_context(user_id: str) -> Dict[str, Any]:
    """
    Get recent activity context for the user
    """
    try:
        table = dynamodb.Table(TABLE_NAME)
        
        # Get last 10 activities
        response = table.query(
            KeyConditionExpression='user_id = :user_id',
            FilterExpression='event_type = :event_type',
            ExpressionAttributeValues={
                ':user_id': user_id,
                ':event_type': 'activity'
            },
            ScanIndexForward=False,  # Get most recent first
            Limit=10
        )
        
        activities = response.get('Items', [])
        
        # Calculate recent summary
        recent_summary = summarize_recent_activities(activities)
        
        return {
            'recentActivities': activities,
            'recentSummary': recent_summary,
            'activityCount': len(activities)
        }
        
    except Exception as e:
        print(f"Error getting recent context: {str(e)}")
        return {
            'recentActivities': [],
            'recentSummary': 'No recent activity',
            'activityCount': 0
        }

def summarize_recent_activities(activities: List[Dict[str, Any]]) -> str:
    """
    Generate a summary of recent activities
    """
    if not activities:
        return 'Starting new session'
    
    # Group by app
    app_counts = {}
    for activity in activities[:5]:  # Last 5 activities
        app = activity.get('app', 'Unknown')
        app_counts[app] = app_counts.get(app, 0) + 1
    
    # Create summary
    top_apps = sorted(app_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    summary_parts = [f"{count} {app}" for app, count in top_apps]
    
    return f"Recent: {', '.join(summary_parts)}"

def get_sagemaker_score(activity_data: Dict[str, Any], context: Dict[str, Any]) -> float:
    """
    Get focus score from SageMaker model
    """
    try:
        # Prepare features for SageMaker
        features = prepare_features(activity_data, context)
        
        # Call SageMaker endpoint
        response = sagemaker.invoke_endpoint(
            EndpointName=SAGEMAKER_ENDPOINT,
            ContentType='text/csv',
            Body=','.join(map(str, features))
        )
        
        # Parse response
        result = json.loads(response['Body'].read().decode())
        pre_score = result.get('predictions', [{}])[0].get('score', 0.5)
        
        return float(pre_score)
        
    except Exception as e:
        print(f"Error getting SageMaker score: {str(e)}")
        # Fallback to simple heuristic
        return calculate_heuristic_score(activity_data)

def prepare_features(activity_data: Dict[str, Any], context: Dict[str, Any]) -> List[float]:
    """
    Prepare features for SageMaker model
    """
    # Basic features
    features = [
        encode_app(activity_data.get('app', 'Unknown')),
        encode_url_domain(activity_data.get('url', '')),
        float(activity_data.get('keystrokes', 0)) / 100.0,  # Normalize
        float(activity_data.get('mouse', 0)) / 50.0,  # Normalize
        context.get('activityCount', 0) / 10.0,  # Normalize
    ]
    
    # Time-based features
    current_hour = datetime.now().hour
    features.extend([
        current_hour / 24.0,
        1.0 if 9 <= current_hour <= 17 else 0.0,  # Work hours
        1.0 if current_hour >= 22 or current_hour <= 6 else 0.0,  # Late night
    ])
    
    return features

def encode_app(app_name: str) -> float:
    """
    Encode app name to numeric feature
    """
    # Simple encoding based on app category
    productive_apps = ['VS Code', 'Xcode', 'IntelliJ', 'Sublime', 'Vim', 'Terminal']
    neutral_apps = ['Finder', 'System Preferences', 'Activity Monitor']
    distracting_apps = ['Chrome', 'Safari', 'Firefox', 'Discord', 'Slack']
    
    if any(prod in app_name for prod in productive_apps):
        return 1.0
    elif any(neutral in app_name for neutral in neutral_apps):
        return 0.5
    elif any(dist in app_name for dist in distracting_apps):
        return 0.0
    else:
        return 0.3

def encode_url_domain(url: str) -> float:
    """
    Encode URL domain to numeric feature
    """
    if not url:
        return 0.5
    
    productive_domains = ['github.com', 'stackoverflow.com', 'leetcode.com', 'docs.python.org']
    distracting_domains = ['youtube.com', 'twitter.com', 'facebook.com', 'instagram.com']
    
    if any(domain in url for domain in productive_domains):
        return 1.0
    elif any(domain in url for domain in distracting_domains):
        return 0.0
    else:
        return 0.5

def calculate_heuristic_score(activity_data: Dict[str, Any]) -> float:
    """
    Fallback heuristic score calculation
    """
    app = activity_data.get('app', '').lower()
    title = activity_data.get('title', '').lower()
    url = activity_data.get('url', '').lower()
    
    score = 0.5  # Base score
    
    # App-based scoring
    if any(prod in app for prod in ['vs code', 'xcode', 'intellij', 'sublime']):
        score += 0.3
    elif any(dist in app for dist in ['chrome', 'safari', 'firefox']):
        score -= 0.2
    
    # URL-based scoring
    if any(prod in url for prod in ['github', 'stackoverflow', 'leetcode']):
        score += 0.2
    elif any(dist in url for dist in ['youtube', 'twitter', 'facebook']):
        score -= 0.3
    
    # Title-based scoring
    if any(prod in title for prod in ['code', 'debug', 'function', 'class']):
        score += 0.1
    elif any(dist in title for dist in ['video', 'chat', 'game']):
        score -= 0.2
    
    return max(0.0, min(1.0, score))

def generate_ai_response(activity_data: Dict[str, Any], context: Dict[str, Any], pre_score: float) -> Dict[str, Any]:
    """
    Generate AI response using Bedrock Claude
    """
    try:
        # Build prompt
        prompt = build_ai_prompt(activity_data, context, pre_score)
        
        # Call Bedrock
        response = bedrock.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 200,
                'messages': [
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ]
            }),
            contentType='application/json'
        )
        
        # Parse response
        response_body = json.loads(response['body'].read())
        ai_content = response_body['content'][0]['text']
        
        # Parse JSON response
        ai_response = json.loads(ai_content)
        
        return {
            'focus_score': int(ai_response.get('focus_score', pre_score * 100)),
            'label': ai_response.get('label', 'on_task'),
            'nudge': ai_response.get('nudge', 'Stay focused!'),
            'reason': ai_response.get('reason', 'Keep working'),
            'pre_score': pre_score,
            'timestamp': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        print(f"Error generating AI response: {str(e)}")
        # Fallback response
        return generate_fallback_response(activity_data, pre_score)

def build_ai_prompt(activity_data: Dict[str, Any], context: Dict[str, Any], pre_score: float) -> str:
    """
    Build prompt for Bedrock Claude
    """
    return f"""You are Focus AI, a concise productivity coach.

Given the following context and preScore, return JSON with:
- focus_score (0-100)
- label ∈ {{on_task, drifting, off_task}}
- nudge (≤15 words)
- reason (≤15 words)

Context:
RecentSummary: {context.get('recentSummary', 'Starting new session')}
CurrentEvent: {json.dumps(activity_data)}
preScore: {pre_score}

Respond with valid JSON only."""

def generate_fallback_response(activity_data: Dict[str, Any], pre_score: float) -> Dict[str, Any]:
    """
    Generate fallback response when AI fails
    """
    app = activity_data.get('app', 'Unknown')
    title = activity_data.get('title', '')
    
    # Simple classification logic
    if pre_score > 0.7:
        return {
            'focus_score': int(pre_score * 100),
            'label': 'on_task',
            'nudge': 'Great focus! Keep it up.',
            'reason': 'High productivity detected',
            'pre_score': pre_score,
            'timestamp': datetime.utcnow().isoformat()
        }
    elif pre_score > 0.4:
        return {
            'focus_score': int(pre_score * 100),
            'label': 'drifting',
            'nudge': 'Stay on track!',
            'reason': 'Moderate focus level',
            'pre_score': pre_score,
            'timestamp': datetime.utcnow().isoformat()
        }
    else:
        return {
            'focus_score': int(pre_score * 100),
            'label': 'off_task',
            'nudge': 'Time to refocus!',
            'reason': 'Low productivity detected',
            'pre_score': pre_score,
            'timestamp': datetime.utcnow().isoformat()
        }

def store_classification_result(user_id: str, activity_data: Dict[str, Any], result: Dict[str, Any]) -> None:
    """
    Store classification result in DynamoDB
    """
    try:
        table = dynamodb.Table(TABLE_NAME)
        
        item = {
            'user_id': user_id,
            'timestamp': result['timestamp'],
            'app': activity_data.get('app', 'Unknown'),
            'title': activity_data.get('title', ''),
            'url': activity_data.get('url'),
            'focus_score': result['focus_score'],
            'label': result['label'],
            'nudge': result['nudge'],
            'reason': result['reason'],
            'pre_score': result['pre_score'],
            'event_type': 'classification',
            'ttl': int(datetime.utcnow().timestamp()) + (30 * 24 * 60 * 60)
        }
        
        table.put_item(Item=item)
        
    except Exception as e:
        print(f"Error storing classification result: {str(e)}")


