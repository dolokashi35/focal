import pytest
import json
from unittest.mock import Mock, patch
import sys
import os

# Add the lambdas directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambdas'))

from ingest.index import lambda_handler as ingest_handler
from classify.index import lambda_handler as classify_handler

class TestIngestLambda:
    """Test cases for the ingest Lambda function"""
    
    def test_ingest_valid_events(self):
        """Test ingesting valid activity events"""
        event = {
            'body': json.dumps({
                'events': [
                    {
                        'user_id': 'test_user',
                        'app': 'VS Code',
                        'title': 'main.py',
                        'url': None,
                        'keystrokes': 45,
                        'mouse': 12,
                        'timestamp': '2024-01-15T09:00:00Z'
                    }
                ]
            })
        }
        
        with patch('ingest.index.dynamodb') as mock_dynamodb, \
             patch('ingest.index.s3') as mock_s3:
            
            # Mock DynamoDB table
            mock_table = Mock()
            mock_dynamodb.Table.return_value = mock_table
            
            response = ingest_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['message'] == 'Processed 1 events'
            assert len(body['results']) == 1
            assert body['results'][0]['status'] == 'success'
            
            # Verify DynamoDB put_item was called
            mock_table.put_item.assert_called_once()
    
    def test_ingest_screenshot_event(self):
        """Test ingesting screenshot events with OCR"""
        event = {
            'body': json.dumps({
                'events': [
                    {
                        'user_id': 'test_user',
                        'type': 'screenshot',
                        'data': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                        'timestamp': '2024-01-15T09:00:00Z'
                    }
                ]
            })
        }
        
        with patch('ingest.index.dynamodb') as mock_dynamodb, \
             patch('ingest.index.s3') as mock_s3, \
             patch('ingest.index.textract') as mock_textract:
            
            # Mock DynamoDB table
            mock_table = Mock()
            mock_dynamodb.Table.return_value = mock_table
            
            # Mock S3
            mock_s3.put_object.return_value = {}
            
            # Mock Textract
            mock_textract.detect_document_text.return_value = {
                'Blocks': [
                    {'BlockType': 'LINE', 'Text': 'Hello World', 'Confidence': 95.0}
                ]
            }
            
            response = ingest_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert len(body['results']) == 1
            assert body['results'][0]['type'] == 'screenshot'
            assert 'ocr_text' in body['results'][0]
            
            # Verify S3 and Textract were called
            mock_s3.put_object.assert_called_once()
            mock_textract.detect_document_text.assert_called_once()
    
    def test_ingest_empty_events(self):
        """Test handling empty events array"""
        event = {
            'body': json.dumps({
                'events': []
            })
        }
        
        response = ingest_handler(event, None)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'error' in body
    
    def test_ingest_invalid_json(self):
        """Test handling invalid JSON"""
        event = {
            'body': 'invalid json'
        }
        
        response = ingest_handler(event, None)
        
        assert response['statusCode'] == 500

class TestClassifyLambda:
    """Test cases for the classify Lambda function"""
    
    def test_classify_productive_activity(self):
        """Test classifying a productive activity"""
        event = {
            'body': json.dumps({
                'user_id': 'test_user',
                'app': 'VS Code',
                'title': 'main.py - FocusLens',
                'url': None,
                'keystrokes': 45,
                'mouse': 12,
                'timestamp': '2024-01-15T09:00:00Z'
            })
        }
        
        with patch('classify.index.dynamodb') as mock_dynamodb, \
             patch('classify.index.sagemaker') as mock_sagemaker, \
             patch('classify.index.bedrock') as mock_bedrock:
            
            # Mock DynamoDB
            mock_table = Mock()
            mock_dynamodb.Table.return_value = mock_table
            mock_table.query.return_value = {'Items': []}
            
            # Mock SageMaker
            mock_sagemaker.invoke_endpoint.return_value = {
                'Body': Mock()
            }
            mock_sagemaker.invoke_endpoint.return_value['Body'].read.return_value = b'{"predictions": [{"score": 0.85}]}'
            
            # Mock Bedrock
            mock_bedrock.invoke_model.return_value = {
                'body': Mock()
            }
            mock_bedrock.invoke_model.return_value['body'].read.return_value = json.dumps({
                'content': [{'text': '{"focus_score": 85, "label": "on_task", "nudge": "Great work!", "reason": "Coding activity"}'}]
            })
            
            response = classify_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['focus_score'] == 85
            assert body['label'] == 'on_task'
            assert 'nudge' in body
            assert 'reason' in body
    
    def test_classify_distracting_activity(self):
        """Test classifying a distracting activity"""
        event = {
            'body': json.dumps({
                'user_id': 'test_user',
                'app': 'Chrome',
                'title': 'YouTube - Funny Videos',
                'url': 'https://youtube.com/watch?v=funny',
                'keystrokes': 25,
                'mouse': 35,
                'timestamp': '2024-01-15T09:00:00Z'
            })
        }
        
        with patch('classify.index.dynamodb') as mock_dynamodb, \
             patch('classify.index.sagemaker') as mock_sagemaker, \
             patch('classify.index.bedrock') as mock_bedrock:
            
            # Mock DynamoDB
            mock_table = Mock()
            mock_dynamodb.Table.return_value = mock_table
            mock_table.query.return_value = {'Items': []}
            
            # Mock SageMaker with low score
            mock_sagemaker.invoke_endpoint.return_value = {
                'Body': Mock()
            }
            mock_sagemaker.invoke_endpoint.return_value['Body'].read.return_value = b'{"predictions": [{"score": 0.25}]}'
            
            # Mock Bedrock
            mock_bedrock.invoke_model.return_value = {
                'body': Mock()
            }
            mock_bedrock.invoke_model.return_value['body'].read.return_value = json.dumps({
                'content': [{'text': '{"focus_score": 25, "label": "off_task", "nudge": "Get back to work!", "reason": "Social media detected"}'}]
            })
            
            response = classify_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['focus_score'] == 25
            assert body['label'] == 'off_task'
    
    def test_classify_fallback_response(self):
        """Test fallback response when AI services fail"""
        event = {
            'body': json.dumps({
                'user_id': 'test_user',
                'app': 'Unknown App',
                'title': 'Unknown Title',
                'url': None,
                'keystrokes': 30,
                'mouse': 15,
                'timestamp': '2024-01-15T09:00:00Z'
            })
        }
        
        with patch('classify.index.dynamodb') as mock_dynamodb, \
             patch('classify.index.sagemaker') as mock_sagemaker, \
             patch('classify.index.bedrock') as mock_bedrock:
            
            # Mock DynamoDB
            mock_table = Mock()
            mock_dynamodb.Table.return_value = mock_table
            mock_table.query.return_value = {'Items': []}
            
            # Mock SageMaker to raise exception
            mock_sagemaker.invoke_endpoint.side_effect = Exception("SageMaker error")
            
            response = classify_handler(event, None)
            
            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            # Should return fallback response with heuristic score
            assert 'focus_score' in body
            assert 'label' in body
            assert 'nudge' in body
            assert 'reason' in body

class TestMockResponses:
    """Test mock response generation"""
    
    def test_mock_productive_response(self):
        """Test mock response for productive activity"""
        from classify.index import generate_fallback_response
        
        activity_data = {
            'app': 'VS Code',
            'title': 'main.py'
        }
        
        response = generate_fallback_response(activity_data, 0.85)
        
        assert response['focus_score'] == 85
        assert response['label'] == 'on_task'
        assert response['nudge'] == 'Great focus! Keep it up.'
        assert response['reason'] == 'High productivity detected'
    
    def test_mock_distracting_response(self):
        """Test mock response for distracting activity"""
        from classify.index import generate_fallback_response
        
        activity_data = {
            'app': 'Chrome',
            'title': 'YouTube - Videos'
        }
        
        response = generate_fallback_response(activity_data, 0.25)
        
        assert response['focus_score'] == 25
        assert response['label'] == 'off_task'
        assert response['nudge'] == 'Time to refocus!'
        assert response['reason'] == 'Low productivity detected'

if __name__ == '__main__':
    pytest.main([__file__])


