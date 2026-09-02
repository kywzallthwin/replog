import { BrandedLoader } from './BrandedLoader'

type PageLoaderProps = {
  statusMessage?: string
}

export function PageLoader({ statusMessage }: PageLoaderProps) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_-4px_rgba(0,0,0,0.12)]">
      <BrandedLoader statusMessage={statusMessage} />
    </section>
  )
}
