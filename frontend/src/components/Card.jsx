// Simple presentational Card component with optional title, subtitle, footer,
// and an optional onClick to make the whole card clickable.
export default function Card({ title, subtitle, children, footer, onClick }) {
  return (
    <div className="card" onClick={onClick} style={{cursor:onClick?"pointer":"default"}}>
      {title && <h3>{title}</h3>}
      {subtitle && <div className="small" style={{marginTop:-6, marginBottom:8}}>{subtitle}</div>}
      {children}
      {footer && <div style={{marginTop:12}}>{footer}</div>}
    </div>
  );
}
