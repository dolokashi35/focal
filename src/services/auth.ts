import axios from "axios";
import CryptoJS from "crypto-js";

// Cognito settings come from Vite env vars (see .env.example)
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
const CLIENT_SECRET = import.meta.env.VITE_COGNITO_CLIENT_SECRET as string;
const REGION = (import.meta.env.VITE_COGNITO_REGION as string) || "eu-north-1";
const COGNITO_ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

// Calculate SECRET_HASH for Cognito requests
function calculateSecretHash(username: string): string {
	const message = username + CLIENT_ID;
	const hash = CryptoJS.HmacSHA256(message, CLIENT_SECRET);
	return CryptoJS.enc.Base64.stringify(hash);
}

export interface AuthUser {
	userId: string; // UUID from Cognito (sub)
	username: string;
	email?: string;
}

class AuthService {
	// Sign up a new user
	async signUp(username: string, email: string, password: string): Promise<any> {
		try {
			const secretHash = calculateSecretHash(username);

			const requestBody = {
				ClientId: CLIENT_ID,
				Username: username,
				Password: password,
				SecretHash: secretHash,
				UserAttributes: [
					{
						Name: "email",
						Value: email,
					},
					{
						Name: "preferred_username",
						Value: username,
					},
				],
			};

			console.log("Sign up request:", { ...requestBody, Password: "***", SecretHash: "***" });

			const response = await axios.post(COGNITO_ENDPOINT, requestBody, {
				headers: {
					"Content-Type": "application/x-amz-json-1.1",
					"X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp",
				},
			});

			return response.data;
		} catch (error: any) {
			console.error("Sign up API error:", error.response?.data || error);
			throw error.response?.data || error;
		}
	}

	// Confirm sign up with verification code
	async confirmSignUp(username: string, code: string): Promise<void> {
		try {
			const secretHash = calculateSecretHash(username);

			await axios.post(
				COGNITO_ENDPOINT,
				{
					ClientId: CLIENT_ID,
					Username: username,
					ConfirmationCode: code,
					SecretHash: secretHash,
				},
				{
					headers: {
						"Content-Type": "application/x-amz-json-1.1",
						"X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmSignUp",
					},
				}
			);
		} catch (error: any) {
			throw error.response?.data || error;
		}
	}

	// Sign in
	async signIn(username: string, password: string): Promise<any> {
		try {
			const secretHash = calculateSecretHash(username);

			const response = await axios.post(
				COGNITO_ENDPOINT,
				{
					ClientId: CLIENT_ID,
					AuthFlow: "USER_PASSWORD_AUTH",
					AuthParameters: {
						USERNAME: username,
						PASSWORD: password,
						SECRET_HASH: secretHash,
					},
				},
				{
					headers: {
						"Content-Type": "application/x-amz-json-1.1",
						"X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
					},
				}
			);

			// Store tokens in localStorage for session management
			if (response.data.AuthenticationResult) {
				localStorage.setItem(
					"cognitoTokens",
					JSON.stringify({
						accessToken: response.data.AuthenticationResult.AccessToken,
						idToken: response.data.AuthenticationResult.IdToken,
						refreshToken: response.data.AuthenticationResult.RefreshToken,
						username: username,
					})
				);
			}

			return response.data;
		} catch (error: any) {
			throw error.response?.data || error;
		}
	}

	// Get current user session
	getCurrentSession(): Promise<any> {
		return new Promise((resolve, reject) => {
			const tokensStr = localStorage.getItem("cognitoTokens");
			if (!tokensStr) {
				reject(new Error("No session found"));
				return;
			}

			try {
				const tokens = JSON.parse(tokensStr);
				resolve(tokens);
			} catch (error) {
				reject(new Error("Invalid session data"));
			}
		});
	}

	// Get user attributes
	async getUserAttributes(): Promise<AuthUser> {
		try {
			const tokens = await this.getCurrentSession();

			const response = await axios.post(
				COGNITO_ENDPOINT,
				{
					AccessToken: tokens.accessToken,
				},
				{
					headers: {
						"Content-Type": "application/x-amz-json-1.1",
						"X-Amz-Target": "AWSCognitoIdentityProviderService.GetUser",
					},
				}
			);

			const attributes = response.data.UserAttributes || [];
			const email = attributes.find((attr: any) => attr.Name === "email")?.Value;
			const sub = attributes.find((attr: any) => attr.Name === "sub")?.Value;

			return {
				userId: sub, // This is the UUID
				username: response.data.Username,
				email,
			};
		} catch (error: any) {
			throw error.response?.data || error;
		}
	}

	// Get just the user ID (UUID) - convenient helper
	async getUserId(): Promise<string> {
		const user = await this.getUserAttributes();
		return user.userId;
	}

	// Sign out
	async signOut(): Promise<void> {
		try {
			const tokens = await this.getCurrentSession();

			await axios.post(
				COGNITO_ENDPOINT,
				{
					AccessToken: tokens.accessToken,
				},
				{
					headers: {
						"Content-Type": "application/x-amz-json-1.1",
						"X-Amz-Target": "AWSCognitoIdentityProviderService.GlobalSignOut",
					},
				}
			);
		} catch (error) {
			// Ignore errors during sign out
		} finally {
			// Always clear local storage
			localStorage.removeItem("cognitoTokens");
		}
	}

	// Resend confirmation code
	async resendConfirmationCode(username: string): Promise<void> {
		try {
			const secretHash = calculateSecretHash(username);

			await axios.post(
				COGNITO_ENDPOINT,
				{
					ClientId: CLIENT_ID,
					Username: username,
					SecretHash: secretHash,
				},
				{
					headers: {
						"Content-Type": "application/x-amz-json-1.1",
						"X-Amz-Target": "AWSCognitoIdentityProviderService.ResendConfirmationCode",
					},
				}
			);
		} catch (error: any) {
			throw error.response?.data || error;
		}
	}
}

export default new AuthService();
