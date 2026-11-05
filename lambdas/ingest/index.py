import json
import boto3
import base64
import os
from datetime import datetime
from typing import List, Dict, Any

# AWS Services
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
textract = boto3.client('textract')

# Environment variables
BUCKET_NAME = os.environ['S3_BUCKET_NAME']
TABLE_NAME = os.environ['DYNAMODB_TABLE_NAME']

def lambda_handler(event, context):
    """
    Lambda function to ingest activity events and store them in AWS
    """
    try:
        # Parse the request body
        body = json.loads(event['body']) if isinstance(event.get('body'), str) else event.get('body', {})
        events = body.get('events', [])
        
        if not events:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'No events provided'})
            }
        
        # Process each event
        results = []
        for event_data in events:
            result = process_event(event_data)
            results.append(result)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': f'Processed {len(events)} events',
                'results': results
            })
        }
        
    except Exception as e:
        print(f"Error processing events: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Internal server error'})
        }

def process_event(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a single activity event
    """
    try:
        # Extract basic event info
        user_id = event_data.get('user_id', 'anonymous')
        timestamp = event_data.get('timestamp', datetime.utcnow().isoformat())
        event_type = event_data.get('type', 'activity')
        
        if event_type == 'screenshot':
            return process_screenshot_event(event_data, user_id, timestamp)
        else:
            return process_activity_event(event_data, user_id, timestamp)
            
    except Exception as e:
        print(f"Error processing event: {str(e)}")
        return {'status': 'error', 'message': str(e)}

def process_activity_event(event_data: Dict[str, Any], user_id: str, timestamp: str) -> Dict[str, Any]:
    """
    Process a regular activity event
    """
    # Store in DynamoDB
    table = dynamodb.Table(TABLE_NAME)
    
    item = {
        'user_id': user_id,
        'timestamp': timestamp,
        'app': event_data.get('app', 'Unknown'),
        'title': event_data.get('title', ''),
        'url': event_data.get('url'),
        'keystrokes': event_data.get('keystrokes', 0),
        'mouse_activity': event_data.get('mouse', 0),
        'event_type': 'activity',
        'ttl': int(datetime.utcnow().timestamp()) + (30 * 24 * 60 * 60)  # 30 days TTL
    }
    
    table.put_item(Item=item)
    
    return {
        'status': 'success',
        'type': 'activity',
        'user_id': user_id,
        'timestamp': timestamp
    }

def process_screenshot_event(event_data: Dict[str, Any], user_id: str, timestamp: str) -> Dict[str, Any]:
    """
    Process a screenshot event with OCR
    """
    try:
        # Extract screenshot data
        screenshot_data = event_data.get('data', '')
        if not screenshot_data:
            return {'status': 'error', 'message': 'No screenshot data'}
        
        # Upload to S3
        s3_key = f"screenshots/{user_id}/{timestamp.replace(':', '-')}.png"
        image_data = base64.b64decode(screenshot_data.replace('data:image/png;base64,', ''))
        
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=s3_key,
            Body=image_data,
            ContentType='image/png'
        )
        
        # Run OCR with Textract
        ocr_result = textract.detect_document_text(
            Document={
                'S3Object': {
                    'Bucket': BUCKET_NAME,
                    'Name': s3_key
                }
            }
        )
        
        # Extract text from OCR result
        ocr_text = extract_text_from_ocr(ocr_result)
        confidence = calculate_ocr_confidence(ocr_result)
        
        # Store in DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        
        item = {
            'user_id': user_id,
            'timestamp': timestamp,
            's3_key': s3_key,
            'ocr_text': ocr_text,
            'ocr_confidence': confidence,
            'event_type': 'screenshot',
            'ttl': int(datetime.utcnow().timestamp()) + (30 * 24 * 60 * 60)
        }
        
        table.put_item(Item=item)
        
        return {
            'status': 'success',
            'type': 'screenshot',
            'user_id': user_id,
            'timestamp': timestamp,
            's3_key': s3_key,
            'ocr_text': ocr_text[:100] + '...' if len(ocr_text) > 100 else ocr_text
        }
        
    except Exception as e:
        print(f"Error processing screenshot: {str(e)}")
        return {'status': 'error', 'message': str(e)}

def extract_text_from_ocr(ocr_result: Dict[str, Any]) -> str:
    """
    Extract text from Textract OCR result
    """
    text_blocks = []
    for block in ocr_result.get('Blocks', []):
        if block.get('BlockType') == 'LINE':
            text_blocks.append(block.get('Text', ''))
    
    return ' '.join(text_blocks)

def calculate_ocr_confidence(ocr_result: Dict[str, Any]) -> float:
    """
    Calculate average confidence from OCR result
    """
    confidences = []
    for block in ocr_result.get('Blocks', []):
        if block.get('BlockType') == 'LINE':
            confidences.append(block.get('Confidence', 0))
    
    return sum(confidences) / len(confidences) if confidences else 0


