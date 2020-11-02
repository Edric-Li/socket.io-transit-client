export default function traverse(iterator, mapper) {
  const result = [];
  for (const value in iterator) {
    if (Object.prototype.hasOwnProperty.call(iterator, value)) {
      result.push(mapper(iterator[value], value) || null);
    }
  }
  return result;
}
