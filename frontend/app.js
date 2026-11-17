import { loadFeatured, loadHomeShows, loadProfile } from "./actions.js";
import "./integrated-events.js";
import { toast } from "./helpers.js";
import { switchView, syncAuthButton, syncHomeMode } from "./render.js";

async function bootstrap() {
  syncAuthButton();
  switchView("home");
  syncHomeMode();

  try {
    await loadFeatured();
    await loadHomeShows();
    await loadProfile();
  } catch (error) {
    toast(error.message);
  }
}

bootstrap();
