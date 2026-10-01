// Ye har controller function ko wrap karta hai taake hum har jagah try/catch na likhein
// Agar controller ke andar koi error aaye, ye automatically errorHandler ko bhej deta hai
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export default asyncHandler
