<template><LegalDocumentPage :document="userAgreementDocument" /></template>

<script setup lang="ts">
import LegalDocumentPage from "@/components/legal/LegalDocumentPage.vue";
import { userAgreementDocument } from "@/legal/legal-documents";
</script>
