"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "@/app/actions/profile";
import { updatePassword } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  User,
  Save,
  Loader2,
  Mail,
  Upload,
  Lock,
  Calendar,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate, cn } from "@/lib/utils";

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, startSaving] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [changing, startChanging] = useTransition();

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setUsername(profile.username ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const displayName = fullName || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSave = () => {
    startSaving(async () => {
      const res = await updateProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim(),
        username: username.trim(),
        phone: phone.trim(),
      });
      if (res.error) toast.error(res.error);
      else {
        await refreshProfile();
        toast.success("Profile updated!");
      }
    });
  };

  const persistAvatar = async (url: string) => {
    setAvatarUrl(url);
    const res = await updateProfile({ avatar_url: url });
    if (res.error) toast.error(res.error);
    else await refreshProfile();
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        toast.error(error.message);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // cache-bust so the new image shows immediately
      await persistAvatar(`${data.publicUrl}?v=${Date.now()}`);
      toast.success("Photo updated!");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    await persistAvatar("");
    toast.success("Photo removed.");
  };

  const handlePassword = () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    startChanging(async () => {
      const fd = new FormData();
      fd.set("password", password);
      const res = await updatePassword(fd);
      // updatePassword redirects on success; only returns on error.
      if (res?.error) toast.error(res.error);
    });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Profile"
        description="Manage your personal information and account"
        icon={<User className="w-5 h-5" />}
      />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Identity card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Info</CardTitle>
              <CardDescription>This is how you appear across Alpha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-violet-500/30">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-lg font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{displayName}</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Full Name</Label>
                <Input
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-2 block">Username</Label>
                  <Input
                    placeholder="yourname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Used to log in. 3–30 chars: letters, numbers, . _ -
                  </p>
                </div>
                <div>
                  <Label className="text-sm mb-2 block">
                    Phone{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    type="tel"
                    placeholder="+1 555 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    A login alias if you forget your username.
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Profile Photo</Label>
                <div
                  onClick={() => !uploading && fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                    uploading && "pointer-events-none opacity-70"
                  )}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && handleFile(e.target.files[0])
                    }
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-sm">Uploading…</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        Drop a photo here or click to upload
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, WEBP or GIF · max 5 MB
                      </p>
                    </>
                  )}
                </div>
                {avatarUrl && (
                  <button
                    onClick={removePhoto}
                    className="mt-2 text-xs text-destructive hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Remove photo
                  </button>
                )}
              </div>

              <div>
                <Label className="text-sm mb-2 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </Label>
                <Input value={user?.email ?? ""} disabled className="opacity-70" />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Email can&apos;t be changed here.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Password card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4" /> Change Password
              </CardTitle>
              <CardDescription>Set a new password for your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-2 block">New Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2 block">Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={handlePassword} disabled={changing}>
                  {changing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Account meta */}
        {profile?.created_at && (
          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Member since {formatDate(profile.created_at)}
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
