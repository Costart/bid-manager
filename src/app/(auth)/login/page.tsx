import { LoginForm } from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  return (
    <Card className="max-w-md w-full p-8">
      <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
        Bid Manager
      </h1>
      <p className="text-center text-gray-600 mb-8">Sign in to continue</p>
      <LoginForm />
    </Card>
  );
}
