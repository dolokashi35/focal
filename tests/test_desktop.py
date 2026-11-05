import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
import sys
import os

# Add the desktop directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'desktop'))

from src.net.api import FocusAPI
from src.tracker.index import ActivityTracker

class TestFocusAPI:
    """Test cases for the FocusAPI class"""
    
    def setup_method(self):
        """Set up test fixtures"""
        with patch.dict(os.environ, {
            'AWS_REGION': 'us-west-2',
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret'
        }):
            self.api = FocusAPI()
    
    def test_api_initialization(self):
        """Test API initialization"""
        assert self.api.config['region'] == 'us-west-2'
        assert self.api.config['region'] is not None
    
    def test_classify_activity_mock_response(self):
        """Test classify activity with mock response"""
        activity_data = {
            'app': 'VS Code',
            'title': 'main.py - FocusLens',
            'url': None,
            'keystrokes': 45,
            'mouse': 12
        }
        
        response = self.api.classifyActivity(activity_data)
        
        assert 'focus_score' in response
        assert 'label' in response
        assert 'nudge' in response
        assert 'reason' in response
        assert isinstance(response['focus_score'], int)
        assert response['focus_score'] >= 0 and response['focus_score'] <= 100
    
    def test_classify_productive_activity(self):
        """Test classification of productive activity"""
        activity_data = {
            'app': 'VS Code',
            'title': 'main.py - FocusLens',
            'url': None,
            'keystrokes': 45,
            'mouse': 12
        }
        
        response = self.api.classifyActivity(activity_data)
        
        # Should be classified as productive
        assert response['focus_score'] >= 70
        assert response['label'] in ['on_task', 'drifting']
    
    def test_classify_distracting_activity(self):
        """Test classification of distracting activity"""
        activity_data = {
            'app': 'Chrome',
            'title': 'YouTube - Funny Videos',
            'url': 'https://youtube.com/watch?v=funny',
            'keystrokes': 25,
            'mouse': 35
        }
        
        response = self.api.classifyActivity(activity_data)
        
        # Should be classified as distracting
        assert response['focus_score'] <= 50
        assert response['label'] in ['off_task', 'drifting']
    
    def test_send_batch_no_api_url(self):
        """Test sending batch when API URL is not configured"""
        events = [
            {
                'user_id': 'test_user',
                'app': 'VS Code',
                'title': 'main.py',
                'timestamp': '2024-01-15T09:00:00Z'
            }
        ]
        
        # Should not raise exception
        result = self.api.sendBatch(events)
        assert result is None
    
    @patch('src.net.api.fetch')
    async def test_send_batch_with_api_url(self, mock_fetch):
        """Test sending batch with configured API URL"""
        self.api.config['apiGatewayUrl'] = 'https://test-api.com'
        
        mock_fetch.return_value.ok = True
        mock_fetch.return_value.json.return_value = {'status': 'success'}
        
        events = [
            {
                'user_id': 'test_user',
                'app': 'VS Code',
                'title': 'main.py',
                'timestamp': '2024-01-15T09:00:00Z'
            }
        ]
        
        result = await self.api.sendBatch(events)
        assert result is not None
        mock_fetch.assert_called_once()

class TestActivityTracker:
    """Test cases for the ActivityTracker class"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.mock_on_activity = Mock()
        self.tracker = ActivityTracker({
            'onActivity': self.mock_on_activity,
            'screenshotInterval': 1000,
            'batchInterval': 1000
        })
    
    def test_tracker_initialization(self):
        """Test tracker initialization"""
        assert not self.tracker.isRunning
        assert self.tracker.buffer == []
        assert self.tracker.lastActivity is None
    
    def test_tracker_start_stop(self):
        """Test starting and stopping the tracker"""
        assert not self.tracker.isRunning
        
        self.tracker.start()
        assert self.tracker.isRunning
        
        self.tracker.stop()
        assert not self.tracker.isRunning
    
    @patch('src.tracker.index.execAsync')
    async def test_get_active_window_info_macos(self, mock_exec):
        """Test getting active window info on macOS"""
        mock_exec.side_effect = [
            ('VS Code', ''),
            ('main.py - FocusLens', '')
        ]
        
        # Mock process.platform
        with patch('src.tracker.index.process.platform', 'darwin'):
            result = await self.tracker.getActiveWindowInfo()
        
        assert result is not None
        assert result['app'] == 'VS Code'
        assert result['title'] == 'main.py - FocusLens'
        assert result['platform'] == 'darwin'
    
    def test_extract_url_browser_apps(self):
        """Test URL extraction for browser apps"""
        # Test Chrome
        url = self.tracker.extractURL('GitHub - FocusLens Repository', 'Chrome')
        assert url is None  # No URL in title
        
        # Test non-browser app
        url = self.tracker.extractURL('main.py - VS Code', 'VS Code')
        assert url is None
    
    def test_has_activity_changed(self):
        """Test activity change detection"""
        # First activity
        activity1 = {
            'app': 'VS Code',
            'title': 'main.py',
            'url': None
        }
        
        assert self.tracker.hasActivityChanged(activity1)
        self.tracker.lastActivity = activity1
        
        # Same activity
        activity2 = {
            'app': 'VS Code',
            'title': 'main.py',
            'url': None
        }
        
        assert not self.tracker.hasActivityChanged(activity2)
        
        # Different activity
        activity3 = {
            'app': 'Chrome',
            'title': 'GitHub',
            'url': 'https://github.com'
        }
        
        assert self.tracker.hasActivityChanged(activity3)
    
    def test_get_keystroke_count(self):
        """Test keystroke count generation"""
        count = self.tracker.getKeystrokeCount()
        assert isinstance(count, int)
        assert 10 <= count <= 60  # Based on the random range in implementation
    
    def test_get_mouse_activity(self):
        """Test mouse activity generation"""
        activity = self.tracker.getMouseActivity()
        assert isinstance(activity, int)
        assert 5 <= activity <= 25  # Based on the random range in implementation
    
    def test_get_user_id(self):
        """Test user ID generation"""
        with patch.dict(os.environ, {'USER_ID': 'test_user'}):
            user_id = self.tracker.getUserId()
            assert user_id == 'test_user'
        
        with patch.dict(os.environ, {}, clear=True):
            user_id = self.tracker.getUserId()
            assert user_id == 'anonymous'
    
    @patch('src.tracker.index.desktopCapturer')
    async def test_capture_screenshot(self, mock_desktop_capturer):
        """Test screenshot capture"""
        # Mock screenshot source
        mock_source = Mock()
        mock_source.thumbnail.toDataURL.return_value = 'data:image/png;base64,test'
        mock_desktop_capturer.getSources.return_value = [mock_source]
        
        await self.tracker.captureScreenshot()
        
        # Check that screenshot was added to buffer
        assert len(self.tracker.buffer) == 1
        screenshot_event = self.tracker.buffer[0]
        assert screenshot_event['type'] == 'screenshot'
        assert 'data' in screenshot_event
        assert 'timestamp' in screenshot_event
    
    def test_flush_buffer(self):
        """Test buffer flushing"""
        # Add some test events
        self.tracker.buffer = [
            {'user_id': 'test', 'app': 'VS Code', 'timestamp': '2024-01-15T09:00:00Z'},
            {'user_id': 'test', 'app': 'Chrome', 'timestamp': '2024-01-15T09:01:00Z'}
        ]
        
        with patch.object(self.tracker, 'sendBatch') as mock_send:
            self.tracker.flushBuffer()
            
            assert len(self.tracker.buffer) == 0
            mock_send.assert_called_once()

class TestIntegration:
    """Integration tests"""
    
    def test_api_and_tracker_integration(self):
        """Test integration between API and tracker"""
        with patch.dict(os.environ, {
            'AWS_REGION': 'us-west-2',
            'AWS_ACCESS_KEY_ID': 'test_key',
            'AWS_SECRET_ACCESS_KEY': 'test_secret'
        }):
            api = FocusAPI()
            tracker = ActivityTracker({
                'onActivity': lambda data: api.classifyActivity(data),
                'screenshotInterval': 1000,
                'batchInterval': 1000
            })
            
            # Simulate activity data
            activity_data = {
                'user_id': 'test_user',
                'app': 'VS Code',
                'title': 'main.py - FocusLens',
                'url': None,
                'keystrokes': 45,
                'mouse': 12,
                'timestamp': '2024-01-15T09:00:00Z'
            }
            
            # Test the integration
            response = api.classifyActivity(activity_data)
            
            assert response is not None
            assert 'focus_score' in response
            assert 'label' in response
            assert 'nudge' in response
            assert 'reason' in response

if __name__ == '__main__':
    pytest.main([__file__])


