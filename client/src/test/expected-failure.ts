export async function failForKnownBaselineDefect(
  check: () => boolean | undefined | Promise<boolean | undefined>,
  description: string,
) {
  let contractResult: boolean | undefined

  try {
    contractResult = await check()
  } catch {
    // Setup and rendering errors must not count as the expected defect.
    return
  }

  if (contractResult === false) {
    throw new Error(`Known W1-01 defect: ${description}`)
  }
}
