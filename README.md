> **Branch note:** This is the original hackathon version of Focal (built at DubHacks). It has a full AWS serverless backend: API Gateway, Lambda, SageMaker, Bedrock, DynamoDB, S3 and Cognito. The current desktop app lives on [`main`](https://github.com/dolokashi35/focal/tree/main).

# Focus AI

A privacy-first desktop productivity coach that understands what you're doing, scores your focus in real-time, and gives concise, AI-generated nudges to stay on task.

## 🧱 System Overview

### Local Layer (Electron + Node)
- **Track**: Active app, URL, window title, and optional blurred screenshots
- **Compute**: Engagement metrics (keystrokes, mouse activity)
- **Upload**: JSON events every 20–30s to AWS API Gateway
- **Interface**: Tray icon + popup React UI showing current focus score
- **Auto-launch**: On startup with encrypted data upload

### AWS Backend (Serverless)
- **API Gateway** → **Lambda (Python)** → orchestrates model calls
- **Textract** (optional) → OCR from screenshot thumbnails
- **SageMaker Linear Learner/XGBoost** → quick numeric focusScore (0–1)
- **Bedrock Claude 3 Sonnet/Haiku** → interprets context, produces human-style feedback
- **DynamoDB** → focus logs, goal states
- **S3** → screenshots / OCR text
- **Cognito** → auth tokens for app users
- **CloudWatch** → logs + metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- AWS CLI configured
- Serverless Framework

### 1. Desktop App Setup
```bash
cd desktop
npm install
cp ../env.example .env
# Edit .env with your AWS credentials and endpoints
npm run dev
```

### 2. AWS Backend Deployment
```bash
# Install serverless dependencies
pip install -r requirements.txt

# Deploy infrastructure
serverless deploy --stage dev

# Deploy SageMaker model (in SageMaker notebook)
# See sagemaker/notebook.ipynb
```

### 3. Configure Environment
After deployment, update your `.env` file with the generated endpoints:
```bash
API_GATEWAY_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com/dev
SAGEMAKER_ENDPOINT=focus-ai-dev-endpoint
COGNITO_USER_POOL_ID=us-west-2_xxxxxxxxx
```

## 🧠 AI Pipeline

1. **SageMaker** → numeric preScore (0–1) from features (app, url, keystrokes)
2. **Bedrock Claude 3** → takes preScore + context → returns:
   ```json
   {
     "focus_score": 78,
     "label": "on_task",
     "nudge": "Nice work! Finish the Arrays problem.",
     "reason": "Coding in LeetCode within study block."
   }
   ```
3. **Lambda** stores result → **DynamoDB**; tray UI updates

## 📁 Repository Structure

```
focus-ai/
├─ desktop/                     # Electron app
│  ├─ main.js                   # Tray, windows, auto-launch
│  ├─ src/renderer/             # React popup UI
│  ├─ src/tracker/              # activity + screenshot capture
│  └─ src/net/                  # AWS API calls
├─ lambdas/
│  ├─ ingest/                   # receives data, writes to S3/Dynamo
│  └─ classify/                 # calls Textract, SageMaker, Bedrock
├─ sagemaker/
│  ├─ notebook.ipynb            # train tiny model
│  └─ seed_data.csv
├─ tests/                       # test stubs + mock responses
├─ serverless.yaml              # infrastructure as code
└─ docs/
   ├─ architecture.png
   └─ prompts.md
```

## 🔧 Development

### Local Testing
```bash
# Run tests
python -m pytest tests/

# Test desktop app locally (mock responses)
cd desktop
npm run dev
```

### AWS Services Setup
1. **SageMaker**: Train model using `sagemaker/notebook.ipynb`
2. **Lambda**: Deploy using `serverless deploy`
3. **Cognito**: User pools created automatically
4. **DynamoDB**: Tables created with TTL for automatic cleanup

### Example Event JSON
```json
{
  "user_id": "abc123",
  "app": "Chrome",
  "url": "leetcode.com",
  "title": "Two Sum – LeetCode",
  "keystrokes": 120,
  "mouse": 8,
  "timestamp": "2025-10-13T10:30Z"
}
```

## 🛡️ Privacy & Security

- **Local Processing**: All activity data processed locally first
- **Encrypted Upload**: Data encrypted before transmission to AWS
- **TTL**: Automatic data deletion after 30 days
- **No Personal Data**: Only app names, titles, and engagement metrics
- **Optional Screenshots**: Blurred thumbnails for OCR (disabled by default)

## 📊 Features

### Desktop App
- **Real-time Tracking**: Monitors active applications and URLs
- **Focus Scoring**: AI-powered productivity assessment
- **Smart Notifications**: Contextual nudges to stay on task
- **Tray Integration**: Minimal system impact with native feel
- **Auto-launch**: Starts with system boot

### AI Coaching
- **Contextual Feedback**: Understands what you're working on
- **Adaptive Scoring**: Learns from your productivity patterns
- **Concise Nudges**: 15-word maximum coaching messages
- **Multi-modal**: Combines app usage, keystrokes, and visual context

### Analytics
- **Focus Trends**: Daily/weekly productivity patterns
- **App Analysis**: Which tools help vs. hurt focus
- **Goal Tracking**: Set and monitor productivity targets
- **Export Data**: Download your data anytime

## 🔑 API Keys & Configuration

The app uses environment variables for configuration. Copy `env.example` to `.env` and fill in:

- **AWS Credentials**: Access key and secret for your AWS account
- **API Endpoints**: Generated after serverless deployment
- **Cognito Settings**: User pool and identity pool IDs
- **Model Endpoints**: SageMaker and Bedrock model IDs

## 🚀 Deployment

### Production Deployment
```bash
# Deploy to production
serverless deploy --stage prod

# Update desktop app configuration
# Set production endpoints in .env

# Build and distribute desktop app
cd desktop
npm run build
```

### Monitoring
- **CloudWatch Logs**: Lambda execution logs
- **CloudWatch Metrics**: API Gateway and Lambda metrics
- **DynamoDB Metrics**: Table performance and usage
- **S3 Access Logs**: Screenshot storage analytics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Documentation**: See `docs/` folder for detailed guides

---

Built with ❤️ for productivity hackers everywhere.