<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("LingDian app launched");
});
</script>

<style>
page {
  background: var(--ld-mini-bg);
  color: var(--ld-mini-text);
}

view,
text {
  box-sizing: border-box;
}
</style>
