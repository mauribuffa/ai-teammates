import "server-only"

import { Daytona } from "@daytona/sdk"

// Reads DAYTONA_API_KEY and DAYTONA_API_URL from the environment.
export const daytona = new Daytona()
