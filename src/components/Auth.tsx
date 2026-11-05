import { useState } from "react";
import authService from "../services/auth";
import { saveUserProfile, setAuthToken } from "../utils/database";
import "./Auth.css";

interface AuthProps {
	onAuthSuccess: () => void;
}

type AuthMode = "signin" | "signup" | "confirm";

const Auth = ({ onAuthSuccess }: AuthProps) => {
	const [mode, setMode] = useState<AuthMode>("signin");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmCode, setConfirmCode] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const handleSignIn = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const response = await authService.signIn(email, password);
			console.log("✅ Sign in successful");
			console.log("📦 Response structure:", Object.keys(response));

			// Send auth token to main process for database operations
			if (response.AuthenticationResult?.IdToken) {
				console.log("🔑 Found IdToken in response, sending to main process...");
				setAuthToken(response.AuthenticationResult.IdToken);
				console.log("🔑 Auth token sent to main process for database operations");
			} else {
				console.warn("⚠️ No IdToken found in response!");
				console.warn("⚠️ Response:", response);
			}

			onAuthSuccess();
		} catch (err: any) {
			const errorCode = err.__type || err.code;
			const errorMessage = err.message || err.Message || "Failed to sign in";

			if (errorCode === "UserNotConfirmedException") {
				setError("Please verify your email. Check your inbox for the confirmation code.");
				setMode("confirm");
			} else if (errorCode === "NotAuthorizedException") {
				setError("Incorrect email or password");
			} else if (errorCode === "UserNotFoundException") {
				setError("User not found. Please check your email.");
			} else {
				setError(errorMessage);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleSignUp = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setMessage("");
		setLoading(true);

		try {
			// Use email as Cognito username and email attribute
			await authService.signUp(email, email, password);
			setMessage("Account created! Please check your email for a verification code.");
			setMode("confirm");
		} catch (err: any) {
			console.error("Sign up error:", err);
			const errorCode = err.__type || err.code;
			const errorMessage = err.message || err.Message || "Failed to sign up";

			if (errorCode === "UsernameExistsException") {
				setError("Username already exists. Please choose a different one.");
			} else if (errorCode === "InvalidPasswordException") {
				setError(
					"Password does not meet requirements. Use at least 8 characters with uppercase, lowercase, and number."
				);
			} else if (errorCode === "InvalidParameterException") {
				setError(`Invalid parameter: ${errorMessage}`);
			} else {
				setError(`${errorCode || "Error"}: ${errorMessage}`);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleConfirm = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setMessage("");
		setLoading(true);

		try {
			// Confirm using email as Cognito username
			await authService.confirmSignUp(email, confirmCode);

			// Auto sign-in to obtain tokens and userId (sub)
			const signInResponse = await authService.signIn(email, password);
			if (signInResponse?.AuthenticationResult?.IdToken) {
				setAuthToken(signInResponse.AuthenticationResult.IdToken);
			}

			// Fetch user attributes to get the UID and persist profile
			try {
				const user = await authService.getUserAttributes();
				await saveUserProfile(user.userId, username, user.email || email);
				console.log("User profile saved after confirmation");
			} catch (profileErr) {
				console.warn("Failed to save user profile after confirmation:", profileErr);
			}

			setMessage("Email verified! You can now sign in.");
			setMode("signin");
			setConfirmCode("");
		} catch (err: any) {
			const errorCode = err.__type || err.code;
			const errorMessage = err.message || err.Message || "Failed to verify code";

			if (errorCode === "CodeMismatchException") {
				setError("Invalid verification code. Please try again.");
			} else if (errorCode === "ExpiredCodeException") {
				setError("Verification code has expired. Please request a new one.");
			} else {
				setError(errorMessage);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleResendCode = async () => {
		setError("");
		setMessage("");
		setLoading(true);

		try {
			// Use email as Cognito username for resending code
			await authService.resendConfirmationCode(email);
			setMessage("Verification code resent! Check your email.");
		} catch (err: any) {
			const errorMessage = err.message || err.Message || "Failed to resend code";
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="auth-container">
			<div className="auth-box">
				<h1 className="auth-title">Focal</h1>
				<p className="auth-subtitle">Focus tracking and productivity</p>

				{error && <div className="auth-error">{error}</div>}
				{message && <div className="auth-message">{message}</div>}

				{mode === "signin" && (
					<form onSubmit={handleSignIn}>
						<h2>Sign In</h2>
						<div className="auth-form-group">
							<label htmlFor="email">Email</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								disabled={loading}
							/>
						</div>
						<div className="auth-form-group">
							<label htmlFor="password">Password</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								disabled={loading}
							/>
						</div>
						<button type="submit" className="auth-button" disabled={loading}>
							{loading ? "Signing in..." : "Sign In"}
						</button>
						<p className="auth-switch">
							Don't have an account?{" "}
							<button
								type="button"
								onClick={() => setMode("signup")}
								className="auth-link"
								disabled={loading}
							>
								Sign Up
							</button>
						</p>
					</form>
				)}

				{mode === "signup" && (
					<form onSubmit={handleSignUp}>
						<h2>Sign Up</h2>
						<div className="auth-form-group">
							<label htmlFor="username">Username</label>
							<input
								id="username"
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								required
								disabled={loading}
							/>
						</div>
						<div className="auth-form-group">
							<label htmlFor="email">Email</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								disabled={loading}
							/>
						</div>
						<div className="auth-form-group">
							<label htmlFor="password">Password</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								disabled={loading}
								placeholder="Min 8 chars, with uppercase, lowercase & number"
							/>
						</div>
						<button type="submit" className="auth-button" disabled={loading}>
							{loading ? "Signing up..." : "Sign Up"}
						</button>
						<p className="auth-switch">
							Already have an account?{" "}
							<button
								type="button"
								onClick={() => setMode("signin")}
								className="auth-link"
								disabled={loading}
							>
								Sign In
							</button>
						</p>
					</form>
				)}

				{mode === "confirm" && (
					<form onSubmit={handleConfirm}>
						<h2>Verify Email</h2>
						<p className="auth-info">Enter the verification code sent to your email</p>
						<div className="auth-form-group">
							<label htmlFor="code">Verification Code</label>
							<input
								id="code"
								type="text"
								value={confirmCode}
								onChange={(e) => setConfirmCode(e.target.value)}
								required
								disabled={loading}
								placeholder="123456"
							/>
						</div>
						<button type="submit" className="auth-button" disabled={loading}>
							{loading ? "Verifying..." : "Verify"}
						</button>
						<button
							type="button"
							onClick={handleResendCode}
							className="auth-button auth-button-secondary"
							disabled={loading}
						>
							Resend Code
						</button>
						<p className="auth-switch">
							<button
								type="button"
								onClick={() => setMode("signin")}
								className="auth-link"
								disabled={loading}
							>
								Back to Sign In
							</button>
						</p>
					</form>
				)}
			</div>
		</div>
	);
};

export default Auth;
