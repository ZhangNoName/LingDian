<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("LingDian app launched");
});
</script>

<style>
page {
  background: var(--ld-bg-page);
  color: var(--ld-text-body);
}

view,
text {
  box-sizing: border-box;
}
</style>
