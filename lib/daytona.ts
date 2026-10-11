import "server-only"

import { Daytona } from "@daytona/sdk"

// Passed explicitly: the SDK refuses to pick an endpoint on its own when
// DAYTONA_API_URL is set both in .env.local and in the process environment.
export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
})
