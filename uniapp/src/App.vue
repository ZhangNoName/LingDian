<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { installMiniAppErrorReporter } from "./logging/reporter";

onLaunch(() => {
  installMiniAppErrorReporter();
});
</script>

<style>
@import "../../theme/miniapp-tokens.css";

page {
  background: var(--ld-mini-bg);
  color: var(--ld-mini-text);
  font-size: var(--ld-font-base, 26rpx);
  line-height: 1.35;
}

view,
text {
  box-sizing: border-box;
}
</style>
