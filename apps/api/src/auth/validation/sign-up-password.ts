// Check each required ASCII character class, including in passwords containing newlines.
export const signUpPasswordPattern = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!-/:-@\[-`{-~])/s;
