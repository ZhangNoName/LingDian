<template><LegalDocumentPage :document="privacyPolicyDocument" /></template>

<script setup lang="ts">
import LegalDocumentPage from "@/components/legal/LegalDocumentPage.vue";
import { privacyPolicyDocument } from "@/legal/legal-documents";
</script>
