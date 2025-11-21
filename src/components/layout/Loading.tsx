import React from 'react'
import { RefreshCw } from 'lucide-react'

interface LoadingProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export const Loading: React.FC<LoadingProps> = ({ 
  message = 'Cargando...', 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8'
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center gap-3">
        <RefreshCw className={`${sizeClasses[size]} animate-spin text-primary`} />
        <span className="text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}

export default Loading