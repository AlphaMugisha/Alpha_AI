import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Forgot Password — Alpha" };

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <ForgotPasswordForm />
    </div>
  );
}
