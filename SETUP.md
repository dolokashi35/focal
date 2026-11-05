# Focus AI Setup Guide

## Prerequisites

### 1. AWS Account Setup
You'll need an AWS account with the following services enabled:
- Lambda
- API Gateway
- DynamoDB
- S3
- SageMaker
- Bedrock
- Cognito
- CloudWatch

### 2. AWS Credentials
You need to configure AWS CLI with your credentials:

```bash
# Install AWS CLI (if not already installed)
brew install awscli

# Configure AWS CLI
aws configure
```

You'll need to provide:
- **AWS Access Key ID**: Get from AWS Console → IAM → Users → Your User → Security Credentials
- **AWS Secret Access Key**: Same location as above
- **Default region**: `us-west-2`
- **Default output format**: `json`

### 3. AWS IAM Permissions
Your AWS user needs these permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "lambda:*",
                "apigateway:*",
                "dynamodb:*",
                "s3:*",
                "sagemaker:*",
                "bedrock:*",
                "cognito-idp:*",
                "cognito-identity:*",
                "logs:*",
                "iam:*",
                "cloudformation:*"
            ],
            "Resource": "*"
        }
    ]
}
```

## Quick Setup

### Option 1: Automated Deployment
```bash
# Run the deployment script
./deploy.sh
```

### Option 2: Manual Setup
```bash
# 1. Configure AWS CLI
aws configure

# 2. Deploy infrastructure
source venv/bin/activate
serverless deploy --stage dev

# 3. Update environment variables
# Copy the outputs from serverless info and update .env file
```

## Post-Deployment Steps

### 1. Train SageMaker Model
```bash
# Open Jupyter notebook
jupyter notebook sagemaker/notebook.ipynb

# Run all cells to train and deploy the model
```

### 2. Test Desktop App
```bash
cd desktop
npm install
npm run dev
```

### 3. Configure Cognito Users
- Go to AWS Console → Cognito → User Pools
- Create test users for authentication
- Or use the API to register users programmatically

## Troubleshooting

### Common Issues

1. **AWS CLI not configured**
   ```bash
   aws configure
   # Enter your credentials when prompted
   ```

2. **Permissions denied**
   - Check your AWS IAM permissions
   - Ensure you have admin access or the required permissions

3. **Region not available**
   - Some AWS services might not be available in all regions
   - Use `us-west-2` or `us-east-1` for best compatibility

4. **Bedrock access denied**
   - Bedrock requires separate access request
   - Go to AWS Console → Bedrock → Model access
   - Request access to Claude models

### Getting Help

1. **Check deployment logs**
   ```bash
   serverless logs -f classify --stage dev
   serverless logs -f ingest --stage dev
   ```

2. **Test API endpoints**
   ```bash
   curl -X POST https://your-api-url/classify \
     -H "Content-Type: application/json" \
     -d '{"app":"VS Code","title":"test","keystrokes":10,"mouse":5}'
   ```

3. **Check Gateway logs**
   - AWS Console → API Gateway → Your API → Logs

## Environment Variables

After deployment, your `.env` file should contain:
```bash
AWS_REGION=us-west-2
API_GATEWAY_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com/dev
S3_BUCKET_NAME=focus-ai-dev-data
DYNAMODB_TABLE_NAME=focus-ai-dev-events
COGNITO_USER_POOL_ID=us-west-2_xxxxxxxxx
COGNITO_IDENTITY_POOL_ID=us-west-2:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Cost Estimation

For development/testing:
- **Lambda**: ~$0.20/month (1M requests)
- **DynamoDB**: ~$0.25/month (25GB storage)
- **S3**: ~$0.023/month (1GB storage)
- **API Gateway**: ~$3.50/month (1M requests)
- **SageMaker**: ~$0.046/hour (ml.t3.medium)
- **Bedrock**: ~$3.00/1M tokens (Claude 3 Sonnet)

**Total estimated cost**: ~$10-20/month for light usage

