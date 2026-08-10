import type { SVGProps } from "react";

type IconProps = Readonly<{ size?: number; active?: boolean }> & SVGProps<SVGSVGElement>;

function IconBase({ size = 22, active = false, children, ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

export function IconTreino(props: IconProps) { return <IconBase {...props}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></IconBase>; }
export function IconPlano(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v8.5h8.5M12 12 6.5 17.5" /></IconBase>; }
export function IconCheckin(props: IconProps) { return <IconBase {...props}><path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z" /><path d="M16 5.5h2.5a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1H8" /><path d="m9 13 2 2 4-4" /></IconBase>; }
export function IconDocumentos(props: IconProps) { return <IconBase {...props}><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8zM14 3.5V8h4.5M9 13h6M9 16.5h4" /></IconBase>; }
export function IconEvolucao(props: IconProps) { return <IconBase {...props}><path d="M4 19h16M5 15l4.5-5 3.5 3.5L19 6" /></IconBase>; }
export function IconInicio(props: IconProps) { return <IconBase {...props}><path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5" /></IconBase>; }
