'use client';

import { Linkedin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function LinkedInBadge({ className }: { className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#0A66C2] ${className || ''}`}>
            <Linkedin className="h-2.5 w-2.5 text-white" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>LinkedIn conectado</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
