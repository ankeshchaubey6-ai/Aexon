import { cn } from "../../utils/cn.js";

export function AuthLayout({ children, brand, image, className }) {
  return (
    <div className="min-h-screen flex">
      <div className={cn("flex-1 flex items-center justify-center px-6 py-12", className)}>
        <div className="w-full max-w-sm">
          {brand && <div className="mb-10">{brand}</div>}
          {children}
        </div>
      </div>
      {image && (
        <div className="hidden lg:block flex-1 relative bg-blue-600">
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20"/>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/80 to-violet-700/80"/>
        </div>
      )}
    </div>
  );
}
