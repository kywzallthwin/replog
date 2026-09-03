import { BrandedLoader } from './BrandedLoader'

type PageLoaderProps = {
  statusMessage?: string
}

export function PageLoader({ statusMessage }: PageLoaderProps) {
  return (
    <div className="grid min-h-[250px] place-items-center rounded-[24px] bg-white p-7 text-center shadow-[0_10px_26px_rgba(15,23,42,0.09)]">
      <BrandedLoader statusMessage={statusMessage} />
    </div>
  )
}
