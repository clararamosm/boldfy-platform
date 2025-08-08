import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg 
      width="32" 
      height="32" 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
    >
        <rect width="32" height="32" rx="8" fill="currentColor"/>
        <path d="M15.904 23.3333V14.0207H11.7387V10.2933H15.904V8.48C15.904 5.25333 17.7653 3.57333 20.6613 3.57333H23.5947V7.29333H21.5C20.1013 7.29333 19.808 7.94667 19.808 8.93333V10.2933H23.632L23.0187 14.0207H19.808V23.3333H15.904Z" fill="white"/>
    </svg>
  );
}
