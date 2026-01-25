import Image from "next/image"

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image src="/images/logo.png" alt="COMPTALINK" width={120} height={40} className="h-auto" />
    </div>
  )
}
