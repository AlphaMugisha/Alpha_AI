import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = { title: "Create Account — Alpha" };

export default function SignupPage() {
  return (
    <div className="w-full max-w-md">
      <SignupForm />
    </div>
  );
}
