import { createContext, useContext, useEffect, useState } from "react";
import { getUserData, saveUserData, clearUserData } from "@/utils/storage";
import React from "react";
import axios from "axios";

// ✅ Use environment variable for flexibility (you can change this at runtime)
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// ✅ Updated Type Definition
type AuthContextType = {
  isAuthenticated: boolean;
  user: { _id: string; name: string; email: string } | null;
  isLoading: boolean;
  Signup: (fullName: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; resetToken?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ _id: string; name: string; email: string } | null>(null);

  useEffect(() => {
    checkStoredUser();
  }, []);

  const checkStoredUser = async () => {
    try {
      const data = await getUserData();
      if (data._id && data.name && data.email) {
        setUser({ _id: data._id, name: data.name, email: data.email });
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Error checking stored user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_BASE_URL}/user/login`, {
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.data?.user) {
        const { _id, name, email } = response.data.user;
        await saveUserData(_id, name, email);
        setUser({ _id, name, email });
        setIsAuthenticated(true);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.response?.status === 401) {
        throw new Error("Invalid email or password");
      } else if (!error.response) {
        throw new Error("Network error. Please check your connection.");
      } else {
        throw new Error(error.response.data?.message || "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const Signup = async (fullName: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_BASE_URL}/user/signup`, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.data?.user) {
        const { _id, name, email } = response.data.user;
        await saveUserData(_id, name, email);
        setUser({ _id, name, email });
        setIsAuthenticated(true);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.response?.status === 409) {
        throw new Error("An account with this email already exists");
      } else if (!error.response) {
        throw new Error("Network error. Please check your connection.");
      } else {
        throw new Error(error.response.data?.message || "Signup failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await clearUserData();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ✅ Forgot Password
  const forgotPassword = async (
    email: string
  ): Promise<{ message: string; resetToken?: string }> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/user/forgot-password`, {
        email: email.trim().toLowerCase(),
      });
      return response.data;
    } catch (error: any) {
      console.error("Forgot password error:", error);
      if (!error.response) {
        throw new Error("Network error. Please check your connection.");
      }
      throw new Error(error.response.data?.message || "Failed to send reset email");
    }
  };

  // ✅ Reset Password
  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    try {
      await axios.post(`${API_BASE_URL}/user/reset-password`, {
        token,
        newPassword,
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      if (!error.response) {
        throw new Error("Network error. Please check your connection.");
      }
      throw new Error(error.response.data?.message || "Failed to reset password");
    }
  };

  // ✅ Return Context Value
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        Signup,
        login,
        logout,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
