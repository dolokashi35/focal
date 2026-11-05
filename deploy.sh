#!/bin/bash

# Focus AI Deployment Script
echo "🚀 Deploying Focus AI to AWS..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    echo "You'll need:"
    echo "  - AWS Access Key ID"
    echo "  - AWS Secret Access Key"
    echo "  - Default region (us-west-2)"
    echo "  - Default output format (json)"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing Python dependencies..."
pip install -r requirements.txt

# Deploy serverless infrastructure
echo "☁️ Deploying AWS infrastructure..."
serverless deploy --stage dev

# Get deployment outputs
echo "📋 Getting deployment outputs..."
API_URL=$(serverless info --stage dev | grep "ApiUrl:" | awk '{print $2}')
S3_BUCKET=$(serverless info --stage dev | grep "DataBucketName:" | awk '{print $2}')
DYNAMO_TABLE=$(serverless info --stage dev | grep "EventsTableName:" | awk '{print $2}')
COGNITO_USER_POOL=$(serverless info --stage dev | grep "CognitoUserPoolId:" | awk '{print $2}')
COGNITO_IDENTITY_POOL=$(serverless info --stage dev | grep "CognitoIdentityPoolId:" | awk '{print $2}')

# Create .env file with deployment outputs
echo "⚙️ Creating environment configuration..."
cat > .env << EOF
# AWS Configuration
AWS_REGION=us-west-2
API_GATEWAY_URL=$API_URL
S3_BUCKET_NAME=$S3_BUCKET
DYNAMODB_TABLE_NAME=$DYNAMO_TABLE
COGNITO_USER_POOL_ID=$COGNITO_USER_POOL
COGNITO_IDENTITY_POOL_ID=$COGNITO_IDENTITY_POOL

# Application Configuration
USER_ID=anonymous
AUTO_LAUNCH=true
SCREENSHOT_INTERVAL=30000
BATCH_INTERVAL=20000

# Development Configuration
NODE_ENV=development
DEBUG=true
EOF

echo "✅ Deployment complete!"
echo ""
echo "📊 Deployment Summary:"
echo "  API URL: $API_URL"
echo "  S3 Bucket: $S3_BUCKET"
echo "  DynamoDB Table: $DYNAMO_TABLE"
echo "  Cognito User Pool: $COGNITO_USER_POOL"
echo "  Cognito Identity Pool: $COGNITO_IDENTITY_POOL"
echo ""
echo "🎯 Next Steps:"
echo "  1. Train SageMaker model: Run sagemaker/notebook.ipynb"
echo "  2. Test desktop app: cd desktop && npm run dev"
echo "  3. Configure Cognito users in AWS Console"
echo ""
echo "📁 Environment file created: .env"
echo "🔗 API Documentation: $API_URL/docs"

