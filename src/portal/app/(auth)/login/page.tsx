import { signIn } from '@/app/(auth)/auth';

export default function Page() {
  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h1 className="text-2xl font-bold mb-6">AI Chatbot on AWS</h1>
          <form
            action={async () => {
              'use server';
              await signIn('cognito');
            }}
          >
            <button
              type="submit"
              className="bg-black hover:bg-gray-800 text-white py-2 px-4 rounded"
            >
              Signin with Cognito
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
