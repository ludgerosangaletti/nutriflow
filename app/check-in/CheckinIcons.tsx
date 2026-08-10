import type { SVGProps } from "react";

type IconProps = Readonly<{ size?: number; active?: boolean }> & SVGProps<SVGSVGElement>;
function IconBase({ size = 22, active = false, children, ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}
export function IconResposta(props: IconProps) { return <IconBase {...props}><path d="M20 14.5a2 2 0 0 1-2 2H8l-4 3.5v-14a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2zM8.5 9.5h7M8.5 12.5h4" /></IconBase>; }
export function IconAguardando(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></IconBase>; }
export function IconPeso(props: IconProps) { return <IconBase {...props}><path d="M5 20h14a1 1 0 0 0 1-1.1l-1.4-9A1 1 0 0 0 17.6 9H6.4a1 1 0 0 0-1 .9l-1.4 9A1 1 0 0 0 5 20zM12 9V5.5" /><circle cx="12" cy="4" r="1.5" /><path d="M9.5 13.5 12 12l2.5 1.5" /></IconBase>; }
export function IconTreinos(props: IconProps) { return <IconBase {...props}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></IconBase>; }
