import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user.type';
import { MerchantStoreScope } from '../src/modules/merchant/merchant-store-scope';
import { MultiStoreContextResolver } from '../src/modules/stores/store-context.resolver';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { InventoryUsageService } from '../src/modules/inventory/inventory-usage.service';
import { InventoryRecipeService } from '../src/modules/inventory/inventory-recipe.service';
import { InventoryLifecycleService } from '../src/modules/inventory/inventory-lifecycle.service';
import { PurchasingService } from '../src/modules/inventory/purchasing/purchasing.service';
import { StocktakeService } from '../src/modules/inventory/stocktakes/stocktake.service';
export async function verifyInventoryUsage(db: PrismaService) {
  const storeId = 'usage-a', foreign = 'usage-b';
  for (const id of [storeId, foreign]) {
    await db.store.create({ data: { id, code: id, name: id } });
    await db.category.create({ data: { id: id+'-category', storeId: id, name: 'Category' } });
    await db.product.create({ data: { id: id+'-product', storeId: id, categoryId: id+'-category', name: id === foreign ? 'SecretProduct' : 'Product', price: 1 } });
    await db.supplier.create({ data: { id: id+'-supplier', storeId: id, code: 'S', name: 'Supplier' } });
  }
  const scope = new MerchantStoreScope(new MultiStoreContextResolver(db, new ConfigService({ store: { primaryStoreId: storeId } }))), inventory = new InventoryService(db, scope), usage = new InventoryUsageService(db, scope), recipes = new InventoryRecipeService(db, scope), purchases = new PurchasingService(db, scope), counts = new StocktakeService(db, scope);
  const user: AuthenticatedUser = { userId: 'usage-user', sessionId: 'synthetic', audience: 'merchant-api', roles: ['MERCHANT'], merchantStoreIds: [storeId, foreign] };
  const item = await inventory.create(user, storeId, { code: 'FLOUR', name: 'Flour', unit: 'kg', reorderPoint: 1 }), oil = await inventory.create(user, storeId, { code: 'OIL', name: 'Oil', unit: 'L', reorderPoint: 1 }), other = await inventory.create(user, foreign, { code: 'SECRET', name: 'SecretIngredient', unit: 'L', reorderPoint: 1 });
  for (let n=0;n<26;n++) {
    const id = 'usage-sku-'+String(n).padStart(2,'0');
    await db.productSKU.create({ data: { id, productId: storeId+'-product', skuName: 'Variant '+n, price: 1, isActive: n!==0 } });
    await recipes.save(user, storeId, id, { expectedVersion: 0, entries: [{ itemId: item.id, quantity: n+0.125 }] });
  }
  await db.productSKU.create({ data: { id:'usage-foreign-sku', productId: foreign+'-product', skuName: 'SecretVariant', price:1 } });
  // Simulate legacy cross-store SKU links accepted by the old SKU-only FK.
  await db.inventoryRecipe.create({ data: { storeId, itemId:item.id, skuId:'usage-foreign-sku', quantity:1000 } });
  await db.inventoryRecipe.create({ data: { storeId:foreign, itemId:other.id, skuId:'usage-sku-00', quantity:1000 } });
  const purchase = (key: string, lines = [{ itemId:item.id, quantity:3.125, unitPrice:2 }]) => purchases.create(user, storeId, { requestId:'usage-'+key, supplierId:storeId+'-supplier', note:'', lines });
  const pending = await purchase('pending');
  await purchases.receive(user, storeId, pending.id, { requestId:'usage-first-receipt', expectedVersion:0, note:'Partial', lines:[{ lineId:pending.lines[0].id, quantity:1.125 }] });
  const fulfilledLine = await purchase('fulfilled-line', [{ itemId:item.id, quantity:1, unitPrice:1 }, { itemId:oil.id, quantity:1, unitPrice:1 }]);
  await purchases.receive(user, storeId, fulfilledLine.id, { requestId:'usage-received-line', expectedVersion:0, note:'Flour received', lines:[{ lineId:fulfilledLine.lines.find(line=>line.itemId===item.id)!.id, quantity:1 }] });
  const cancelled = await purchase('cancelled'); await purchases.cancel(user, storeId, cancelled.id, {expectedVersion:0,note:'Cancelled'});
  const full = await purchase('full'); await purchases.receive(user, storeId, full.id, {requestId:'usage-full-receipt', expectedVersion:0,note:'All received',lines:[{lineId:full.lines[0].id,quantity:3.125}]});
  const draft = (key:string,id=item.id) => counts.create(user, storeId, {requestId:'usage-'+key,title:key,note:'',itemIds:[id]});
  const zero = await draft('zero'), blank = await draft('blank'), closed = await draft('cancelled-count'), posted = await draft('posted');
  await counts.save(user, storeId, zero.id, { expectedVersion:0, lines:[{ lineId:zero.lines[0].id, countedQuantity:0 }] });
  await counts.cancel(user, storeId, closed.id, { expectedVersion:0 });
  await counts.save(user, storeId, posted.id, { expectedVersion:0, lines:[{ lineId:posted.lines[0].id, countedQuantity:0 }] });
  await counts.post(user, storeId, posted.id, {expectedVersion:1});
  const balance = await db.inventoryItem.findUniqueOrThrow({where:{id:item.id}});
  const first = await usage.usage(user,storeId,item.id,{view:'RECIPES',page:1}), second = await usage.usage(user,storeId,item.id,{view:'RECIPES',page:2}), last = await usage.usage(user,storeId,item.id,{view:'RECIPES',page:999});
  assert.deepEqual(first.counts,{recipes:26,purchases:1,stocktakes:2}); assert.equal(first.unavailableRecipes,1); assert.equal(first.items.length,20); assert.equal(second.items.length,6); assert.equal(last.page,2);
  const all = [...first.items,...second.items]; assert.equal(new Set(all.map(row=>row.kind==='RECIPES'?row.skuId:'')).size,26);
  assert.ok(all.some(row=>row.kind==='RECIPES'&&!row.skuIsActive&&row.quantity===0.125));
  assert.ok(!JSON.stringify(first).includes('Secret')); assert.ok(!JSON.stringify(first).includes('usage-foreign-sku'));
  const po = await usage.usage(user,storeId,item.id,{view:'PURCHASES',page:1}); assert.equal(po.total,1); assert.ok(po.items[0].kind==='PURCHASES'); if(po.items[0].kind==='PURCHASES'){ assert.equal(po.items[0].orderId,pending.id); assert.equal(po.items[0].remainingQuantity,2); }
  const drafts = await usage.usage(user,storeId,item.id,{view:'STOCKTAKES',page:1}); assert.equal(drafts.total,2); assert.ok(drafts.items.some(row=>row.kind==='STOCKTAKES'&&row.countedQuantity===0)); assert.ok(drafts.items.some(row=>row.kind==='STOCKTAKES'&&row.countedQuantity===null));
  assert.deepEqual(await db.inventoryItem.findUniqueOrThrow({where:{id:item.id}}),balance,'Usage reads do not update stock, version or timestamps');
  await assert.rejects(usage.usage(user,foreign,item.id,{view:'RECIPES',page:1}), /notFound/);
  await assert.rejects(usage.usage({...user,merchantStoreIds:[foreign]},storeId,item.id,{view:'RECIPES',page:1}));
  await assert.rejects(recipes.detail(user,storeId,'usage-foreign-sku'), /skuUnavailable/);
  const exact = await recipes.detail(user,storeId,'usage-sku-00'); assert.equal(exact.entries.length,1); assert.equal(exact.entries[0].itemId,item.id); assert.ok(!JSON.stringify(exact).includes('Secret'));
  assert.ok(!JSON.stringify(await recipes.list(user,storeId,{page:1,pageSize:20})).includes('Secret'));
  const free = await inventory.create(user,storeId,{code:'FREE',name:'Retiring',unit:'bag',reorderPoint:0});
  await db.productSKU.create({data:{id:'usage-fix-sku',productId:storeId+'-product',skuName:'Fix me',price:1}});
  await recipes.save(user,storeId,'usage-fix-sku',{expectedVersion:0,entries:[{itemId:free.id,quantity:1}]});
  const fixPo = await purchase('fix-po',[{itemId:free.id,quantity:1,unitPrice:1}]), fixCount = await draft('fix-count',free.id);
  assert.deepEqual((await usage.usage(user,storeId,free.id,{view:'RECIPES',page:1})).counts,{recipes:1,purchases:1,stocktakes:1});
  await recipes.save(user,storeId,'usage-fix-sku',{expectedVersion:1,entries:[]}); await purchases.cancel(user,storeId,fixPo.id,{expectedVersion:0,note:'Retired'}); await counts.cancel(user,storeId,fixCount.id,{expectedVersion:0});
  assert.deepEqual((await usage.usage(user,storeId,free.id,{view:'RECIPES',page:1})).counts,{recipes:0,purchases:0,stocktakes:0});
  assert.equal((await new InventoryLifecycleService(db,scope).change(user,storeId,free.id,{isActive:false,expectedVersion:0,reason:'Dependencies resolved'})).isActive,false);
  console.log('PASS MySQL related records: complete paged references incl. inactive variants, scoped legacy corruption isolation, exact recipe detail, line-level pending purchases, blank/zero draft counts, readonly snapshots and dependency resolution through to safe archive.');
}
