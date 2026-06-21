import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Reset Password — Alpha" };

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <ResetPasswordForm />
    </div>
  );
}
