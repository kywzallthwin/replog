export function getEmailError(value: string) {
  const email = value.trim()

  if (!email) {
    return 'Email is required.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email address.'
  }

  return undefined
}

export function getRequiredError(value: string, fieldName: string) {
  return value ? undefined : `${fieldName} is required.`
}

export function getUsernameError(value: string) {
  const username = value.trim()

  if (!username) {
    return 'Username is required.'
  }

  if (username.length < 2) {
    return 'Username must be at least 2 characters.'
  }

  if (username.length > 32) {
    return 'Username must be 32 characters or fewer.'
  }

  return undefined
}

export function getPasswordError(value: string) {
  if (!value) {
    return 'Password is required.'
  }

  if (value.length < 8) {
    return 'Use at least 8 characters.'
  }

  if (value.length > 128) {
    return 'Password must be 128 characters or fewer.'
  }

  return undefined
}

export function getConfirmPasswordError(password: string, confirmation: string) {
  if (!confirmation) {
    return 'Please confirm your password.'
  }

  if (password !== confirmation) {
    return 'Passwords do not match.'
  }

  return undefined
}
