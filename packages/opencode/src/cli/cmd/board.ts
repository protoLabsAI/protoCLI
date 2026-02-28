import { cmd } from "./cmd"
import { UI } from "../ui"
import open from "open"

const AUTOMAKER_BOARD_URL = "http://localhost:3008"

export const BoardCommand = cmd({
  command: "board",
  describe: "open the Automaker board in your browser",
  builder: (yargs) => yargs,
  handler: async () => {
    UI.println(UI.Style.TEXT_INFO_BOLD + "  Automaker board:   ", UI.Style.TEXT_NORMAL, AUTOMAKER_BOARD_URL)
    open(AUTOMAKER_BOARD_URL).catch(() => {
      UI.error("Could not open browser. Visit " + AUTOMAKER_BOARD_URL + " manually.")
    })
  },
})
