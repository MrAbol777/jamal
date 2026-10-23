import Link from "next/link";
import { IconBack } from "./icons";

/** سرصفحه با دکمه بازگشت اختیاری */
export function PageHeader({ title, sub, back, children }: { title: React.ReactNode; sub?: React.ReactNode; back?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      {back && (
        <Link href={back} className="icon-btn" aria-label="بازگشت" title="بازگشت">
          <IconBack size={22} />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="page-title truncate">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
