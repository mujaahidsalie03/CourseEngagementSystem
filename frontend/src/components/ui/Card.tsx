export default function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border rounded p-4 mb-4">
      {title && <div className="font-bold text-xl mb-3">{title}</div>}
      {children}
    </div>
  );
}
