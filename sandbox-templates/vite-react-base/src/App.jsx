import { Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-300 text-sm font-medium">
          AI is generating your project...
        </p>
        <p className="text-slate-500 text-xs">
          The preview will update automatically
        </p>
      </div>
    </div>
  );
}