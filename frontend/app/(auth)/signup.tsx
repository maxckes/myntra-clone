import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Check } from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function Signup() {
  const { Signup } = useAuth();
  const router = useRouter();
  
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  
  const [errors, setErrors] = useState<FormErrors>({});

  // Validation functions
  const validateName = (name: string): boolean => {
    return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name.trim());
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validatePassword = (password: string): boolean => {
    // At least 8 characters, one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (!validateName(formData.fullName)) {
      newErrors.fullName = "Please enter a valid name (letters only, min 2 characters)";
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (!validatePassword(formData.password)) {
      newErrors.password = "Password must be at least 8 characters with uppercase, lowercase, and number";
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    // Terms agreement validation
    if (!agreeToTerms) {
      newErrors.general = "Please agree to the Terms of Service";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    // Clear previous errors
    setErrors({});
    
    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      Keyboard.dismiss();
      
      // Call signup function
      await Signup(
        formData.fullName.trim(), 
        formData.email.trim().toLowerCase(), 
        formData.password
      );
      
      // Success - navigate to tabs
      router.replace("/(tabs)");
      
    } catch (error: any) {
      console.error("Signup error:", error);
      
      // Handle different types of errors
      let errorMessage = "Signup failed. Please try again.";
      
      if (error.response?.status === 409) {
        errorMessage = "An account with this email already exists";
      } else if (error.response?.status === 400) {
        errorMessage = "Invalid signup data. Please check your information.";
      } else if (error.response?.status >= 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (!error.response) {
        errorMessage = "Network error. Please check your connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrors({ general: errorMessage });
      Alert.alert("Signup Failed", errorMessage);
      
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const clearGeneralError = () => {
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: undefined }));
    }
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{
            uri: "https://images.pexels.com/photos/5632402/pexels-photo-5632402.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
          }}
          style={styles.backgroundImage}
        />

        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join Myntra and discover amazing fashion
          </Text>

          {/* General Error Message */}
          {errors.general && (
            <View style={styles.errorContainer}>
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          )}

          {/* Full Name Input */}
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="Full Name"
              value={formData.fullName}
              onChangeText={(text) => updateFormData('fullName', text)}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              editable={!isLoading}
            />
            {errors.fullName && (
              <Text style={styles.errorText}>{errors.fullName}</Text>
            )}
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Email"
              value={formData.email}
              onChangeText={(text) => updateFormData('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              editable={!isLoading}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={[
              styles.passwordContainer,
              errors.password && styles.inputError
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                value={formData.password}
                onChangeText={(text) => updateFormData('password', text)}
                secureTextEntry={!showPassword}
                autoComplete="password-new"
                textContentType="newPassword"
                returnKeyType="next"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#666" />
                ) : (
                  <Eye size={20} color="#666" />
                )}
              </TouchableOpacity>
            </View>
            
            {/* Password Strength Indicator */}
            {formData.password.length > 0 && (
              <View style={styles.passwordStrength}>
                <Text style={styles.strengthLabel}>Password strength: </Text>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthBar,
                        passwordStrength >= level && styles.strengthBarActive,
                        passwordStrength >= 3 && level <= passwordStrength && styles.strengthBarGood,
                      ]}
                    />
                  ))}
                </View>
                <Text style={[
                  styles.strengthText,
                  passwordStrength >= 3 && styles.strengthTextGood
                ]}>
                  {passwordStrength < 2 ? 'Weak' : passwordStrength < 3 ? 'Fair' : 'Strong'}
                </Text>
              </View>
            )}
            
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <View style={[
              styles.passwordContainer,
              errors.confirmPassword && styles.inputError
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(text) => updateFormData('confirmPassword', text)}
                secureTextEntry={!showConfirmPassword}
                autoComplete="password-new"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleSignup}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#666" />
                ) : (
                  <Eye size={20} color="#666" />
                )}
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}
          </View>

          {/* Terms Agreement */}
          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => {
              setAgreeToTerms(!agreeToTerms);
              clearGeneralError();
            }}
            disabled={isLoading}
          >
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
              {agreeToTerms && <Check size={14} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the{" "}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {" "}and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Signup Button */}
          <TouchableOpacity
            style={[
              styles.button,
              isLoading && styles.buttonDisabled
            ]}
            onPress={handleSignup}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>SIGN UP</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.push("/login")}
            disabled={isLoading}
          >
            <Text style={styles.loginText}>
              Already have an account?{" "}
              <Text style={styles.loginTextBold}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backgroundImage: {
    width: "100%",
    height: 300,
    resizeMode: "cover",
  },
  formContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: 600,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#3e3e3e",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "#ffe6e6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#ff3f6c",
  },
  generalErrorText: {
    color: "#cc0000",
    fontSize: 14,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 15,
  },
  input: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputError: {
    borderColor: "#ff3f6c",
    backgroundColor: "#fff5f5",
  },
  errorText: {
    color: "#ff3f6c",
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 15,
  },
  passwordStrength: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginLeft: 5,
  },
  strengthLabel: {
    fontSize: 12,
    color: "#666",
    marginRight: 8,
  },
  strengthBars: {
    flexDirection: "row",
    marginRight: 8,
  },
  strengthBar: {
    width: 20,
    height: 4,
    backgroundColor: "#e0e0e0",
    marginRight: 2,
    borderRadius: 2,
  },
  strengthBarActive: {
    backgroundColor: "#ff9800",
  },
  strengthBarGood: {
    backgroundColor: "#4caf50",
  },
  strengthText: {
    fontSize: 12,
    color: "#ff9800",
  },
  strengthTextGood: {
    color: "#4caf50",
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#ff3f6c",
    borderColor: "#ff3f6c",
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  termsLink: {
    color: "#ff3f6c",
    textDecorationLine: "underline",
  },
  button: {
    backgroundColor: "#ff3f6c",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    minHeight: 50,
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ffb3c1",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loginLink: {
    marginTop: 30,
    alignItems: "center",
  },
  loginText: {
    color: "#666",
    fontSize: 16,
  },
  loginTextBold: {
    color: "#ff3f6c",
    fontWeight: "bold",
  },
});
