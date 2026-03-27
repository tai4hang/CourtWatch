/**
 * Remove duplicate courts from Firestore
 * Run: npx tsx scripts/remove-duplicates.ts
 */

import { initFirestore, COLLECTIONS } from '../src/db/firestore.js';

async function removeDuplicates() {
  const db = initFirestore();
  
  console.log('Fetching all courts...');
  const snapshot = await db.collection(COLLECTIONS.COURTS).get();
  
  const courts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`Total courts in Firestore: ${courts.length}`);
  
  // Group by name + city
  const byNameCity = new Map<string, typeof courts>();
  for (const court of courts) {
    const key = `${court.name}|${court.city}`;
    if (!byNameCity.has(key)) {
      byNameCity.set(key, []);
    }
    byNameCity.get(key)!.push(court);
  }
  
  // Find duplicates
  let duplicatesFound = 0;
  const toDelete: string[] = [];
  
  for (const [key, docs] of byNameCity) {
    if (docs.length > 1) {
      console.log(`\nDuplicate: ${key} (${docs.length} copies)`);
      // Keep the first one, delete the rest
      for (let i = 1; i < docs.length; i++) {
        console.log(`  - Deleting: ${docs[i].id}`);
        toDelete.push(docs[i].id);
        duplicatesFound++;
      }
    }
  }
  
  if (toDelete.length === 0) {
    console.log('\nNo duplicates found!');
    return;
  }
  
  console.log(`\nDeleting ${toDelete.length} duplicate courts...`);
  
  const batch = db.batch();
  for (const id of toDelete) {
    batch.delete(db.collection(COLLECTIONS.COURTS).doc(id));
  }
  
  await batch.commit();
  console.log(`Successfully deleted ${duplicatesFound} duplicate courts!`);
}

removeDuplicates().catch(console.error);