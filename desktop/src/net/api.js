import AWS from 'aws-sdk'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') })

export class FocusAPI {
  constructor() {
    this.config = {
      region: process.env.AWS_REGION || 'us-west-2',
      apiGatewayUrl: process.env.API_GATEWAY_URL,
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      identityPoolId: process.env.COGNITO_IDENTITY_POOL_ID
    }
    
    this.setupAWS()
  }

  setupAWS() {
    // Configure AWS SDK
    AWS.config.update({
      region: this.config.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })

    this.apiGateway = new AWS.APIGateway({ region: this.config.region })
    this.s3 = new AWS.S3({ region: this.config.region })
    this.dynamodb = new AWS.DynamoDB.DocumentClient({ region: this.config.region })
    this.textract = new AWS.Textract({ region: this.config.region })
    this.bedrock = new AWS.BedrockRuntime({ region: this.config.region })
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
  }

  async classifyActivity(activityData) {
    try {
      if (!this.config.apiGatewayUrl) {
        console.warn('API Gateway URL not configured, using mock response')
        return this.getMockResponse(activityData)
      }

      const response = await fetch(`${this.config.apiGatewayUrl}/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken()
        },
        body: JSON.stringify(activityData)
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Classification failed:', error)
      return this.getMockResponse(activityData)
    }
  }

  async sendBatch(events) {
    try {
      if (!this.config.apiGatewayUrl) {
        console.log('API Gateway URL not configured, batch not sent')
        return
      }

      const response = await fetch(`${this.config.apiGatewayUrl}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': await this.getAuthToken()
        },
        body: JSON.stringify({ events })
      })

      if (!response.ok) {
        throw new Error(`Batch upload failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Batch upload failed:', error)
      throw error
    }
  }

  async processScreenshot(screenshotData) {
    try {
      // Upload screenshot to S3
      const s3Key = `screenshots/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`
      
      await this.s3.putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: Buffer.from(screenshotData.data.replace(/^data:image\/\w+;base64,/, ''), 'base64'),
        ContentType: 'image/png'
      }).promise()

      // Run OCR with Textract
      const ocrResult = await this.textract.detectDocumentText({
        Document: {
          S3Object: {
            Bucket: process.env.S3_BUCKET_NAME,
            Name: s3Key
          }
        }
      }).promise()

      return {
        s3Key,
        ocrText: this.extractTextFromOCR(ocrResult),
        confidence: this.calculateOCRConfidence(ocrResult)
      }
    } catch (error) {
      console.error('Screenshot processing failed:', error)
      return null
    }
  }

  async callBedrock(context, preScore) {
    try {
      const prompt = this.buildPrompt(context, preScore)
      
      const response = await this.bedrock.invokeModel({
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        }),
        contentType: 'application/json'
      }).promise()

      const responseBody = JSON.parse(response.body.toString())
      return this.parseBedrockResponse(responseBody)
    } catch (error) {
      console.error('Bedrock call failed:', error)
      return this.getMockResponse({})
    }
  }

  buildPrompt(context, preScore) {
    return `You are Focus AI, a concise productivity coach.

Given the following context and preScore, return JSON with:
- focus_score (0-100)
- label ∈ {on_task, drifting, off_task}
- nudge (≤15 words)
- reason (≤15 words)

Context:
RecentSummary: ${context.recentSummary || 'Starting new session'}
CurrentEvent: ${JSON.stringify(context.currentEvent)}
preScore: ${preScore}

Respond with valid JSON only.`
  }

  parseBedrockResponse(response) {
    try {
      const content = response.content[0].text
      return JSON.parse(content)
    } catch (error) {
      console.error('Failed to parse Bedrock response:', error)
      return this.getMockResponse({})
    }
  }

  extractTextFromOCR(ocrResult) {
    return ocrResult.Blocks
      ?.filter(block => block.BlockType === 'LINE')
      ?.map(block => block.Text)
      ?.join(' ') || ''
  }

  calculateOCRConfidence(ocrResult) {
    const lines = ocrResult.Blocks?.filter(block => block.BlockType === 'LINE') || []
    if (lines.length === 0) return 0
    
    const totalConfidence = lines.reduce((sum, line) => sum + (line.Confidence || 0), 0)
    return totalConfidence / lines.length
  }

  async getAuthToken() {
    // Implement Cognito authentication
    // For now, return a placeholder
    return 'Bearer placeholder-token'
  }

  getMockResponse(activityData) {
    const app = activityData.app || 'Unknown'
    const title = activityData.title || 'No title'
    
    // Simple mock classification logic
    let focusScore = 70
    let label = 'on_task'
    let nudge = 'Keep up the good work!'
    let reason = 'Working productively'
    
    if (app.includes('Chrome') || app.includes('Safari')) {
      if (title.includes('youtube') || title.includes('twitter') || title.includes('facebook')) {
        focusScore = 25
        label = 'off_task'
        nudge = 'Get back to work!'
        reason = 'Social media detected'
      } else if (title.includes('leetcode') || title.includes('stackoverflow') || title.includes('github')) {
        focusScore = 85
        label = 'on_task'
        nudge = 'Great coding session!'
        reason = 'Programming activity'
      }
    } else if (app.includes('VS Code') || app.includes('Xcode') || app.includes('IntelliJ')) {
      focusScore = 90
      label = 'on_task'
      nudge = 'Excellent focus!'
      reason = 'IDE detected'
    }
    
    return {
      focus_score: focusScore,
      label,
      nudge,
      reason
    }
  }
}


