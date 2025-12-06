'use client';

interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Loading({ message = 'Đang tải...', size = 'md' }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const dotSizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2.5 h-2.5',
    lg: 'w-3.5 h-3.5',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-body">
      <div className="relative">
        {/* Outer spinning circle with gradient */}
        <div
          className={`${sizeClasses[size]} border-4 border-transparent border-t-indigo-500 border-r-orange-500 rounded-full animate-spin`}
          style={{ animationDuration: '1s' }}
        />
        {/* Inner spinning circle (reverse direction) */}
        <div
          className={`absolute inset-2 border-3 border-transparent border-b-yellow-400 border-l-pink-400 rounded-full animate-spin`}
          style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}
        />
        {/* Pulsing center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`${dotSizeClasses[size]} bg-gradient-to-br from-indigo-500 to-orange-500 rounded-full animate-pulse`} />
        </div>
      </div>
      
      {/* Animated dots below spinner */}
      <div className="flex gap-2 mt-8">
        <div 
          className={`${dotSizeClasses[size]} bg-indigo-500 rounded-full animate-bounce`}
          style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
        />
        <div 
          className={`${dotSizeClasses[size]} bg-orange-500 rounded-full animate-bounce`}
          style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
        />
        <div 
          className={`${dotSizeClasses[size]} bg-yellow-400 rounded-full animate-bounce`}
          style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
        />
      </div>

      {message && (
        <p className={`mt-6 text-gray-700 ${textSizeClasses[size]} font-medium`}>
          <span className="inline-block animate-pulse">{message}</span>
        </p>
      )}
    </div>
  );
}

