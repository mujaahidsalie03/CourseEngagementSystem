export default function TextInput({
  label,
  ...rest
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-2">
      {label && <div className="text-sm mb-1">{label}</div>}
      <input className="border rounded px-3 py-2 w-full" {...rest} />
    </label>
  );
}
