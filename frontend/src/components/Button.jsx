export default function Button({ children, onClick, className="", variant="primary", ...rest }) {
  const cls = ["btn", variant==="secondary"?"secondary":"" , className].join(" ");
  return <button onClick={onClick} className={cls} {...rest}>{children}</button>;
}
