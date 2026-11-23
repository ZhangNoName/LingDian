<script setup lang="ts">
import { onLaunch, onShow } from "@dcloudio/uni-app";
import { miniProgramAuthProvider } from "./config/platform";
import { installMiniAppErrorReporter } from "./logging/reporter";
import { customerAuth } from "./services/auth";
import { fetchMenu } from "./services/catalog";

onLaunch((options) => {
  installMiniAppErrorReporter();
  if (!options?.path || options.path === "pages/home/home") {
    void fetchMenu().catch(() => undefined);
  }
});

onShow(() => {
  if (miniProgramAuthProvider() === "WECHAT" && !customerAuth.isSignedIn()) {
    void customerAuth.refresh();
  }
});
</script>

<style>
@import "../../theme/miniapp-tokens.css";

page,
uni-page-body {
  background: var(--ld-mini-bg);
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.35;
}

view,
text {
  box-sizing: border-box;
}
</style>
