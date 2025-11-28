"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { uploadAvatar } from "@/lib/storage";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { signup, isSigningUp, signupError } = useAuth();
  const router = useRouter();

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUploadError('Please select an image file');
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Image size must be less than 5MB');
        return;
      }

      setUploadError(null);
      setAvatarFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadError(null);
    
    if (password !== confirmPassword) {
      return;
    }

    let photoUrl = null;

    // Upload avatar if provided
    if (avatarFile) {
      try {
        setIsUploading(true);
        // Use a temporary identifier (timestamp + random) before user is created
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        photoUrl = await uploadAvatar(avatarFile, tempId);
      } catch (error) {
        setUploadError(error.message || 'Failed to upload avatar');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    signup({
      email,
      password,
      username,
      gender,
      dob: dob || null,
      photo_url: photoUrl,
    });
  };

  return (
    <div className="flex min-h-screen flex-col max-w-[500px] mx-auto border-r border-l">
      {/* Purple gradient header */}
      <div className="relative flex items-center justify-center flex-1 bg-linear-to-b from-purple-600 via-purple-500 to-purple-400 rounded-b-[3rem] pb-6 pt-12 px-6">
        <h1 className="text-4xl font-bold text-white text-center">Sign Up</h1>
      </div>

      {/* White form section */}
      <div className="flex-1 bg-white px-6">
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-sm text-red-500">Passwords do not match</p>
            )}
          </div>

          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Input
              type="date"
              placeholder="Date of Birth"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
              max={new Date().toISOString().split('T')[0]} // Prevent future dates
            />
          </div>

          <div className="space-y-2">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
              className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Avatar (optional)</label>
            <div className="flex items-center gap-4">
              {avatarPreview && (
                <div className="relative">
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max size: 5MB. Supported formats: JPG, PNG, GIF
                </p>
              </div>
            </div>
            {uploadError && (
              <p className="text-sm text-red-500">{uploadError}</p>
            )}
          </div>

          {signupError && (
            <p className="text-sm text-red-500">{signupError.message}</p>
          )}

          <Button
            type="submit"
            disabled={isSigningUp || isUploading || (password && confirmPassword && password !== confirmPassword)}
            className="w-full"
            size="lg"
          >
            {isUploading ? "Uploading avatar..." : isSigningUp ? "Creating account..." : "Sign up"}
          </Button>

          <p className="text-center text-gray-600 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-500 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

