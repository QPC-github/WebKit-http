/*
 * Copyright (C) 2015-2016 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// Note that the intrisic @typedArrayLength checks that the argument passed is a typed array
// and throws if it is not.


// Typed Arrays have their own species constructor function since they need
// to look up their default constructor, which is expensive. If we used the
// normal speciesConstructor helper we would need to look up the default
// constructor every time.
@globalPrivate
function typedArraySpeciesConstructor(value)
{
    "use strict";
    var constructor = value.constructor;
    if (constructor === @undefined)
        return @typedArrayGetOriginalConstructor(value);

    if (!@isObject(constructor))
        @throwTypeError("|this|.constructor is not an Object or undefined");

    constructor = constructor.@@species;
    if (@isUndefinedOrNull(constructor))
        return @typedArrayGetOriginalConstructor(value);
    // The lack of an @isConstructor(constructor) check here is not observable because
    // the first thing we will do with the value is attempt to construct the result with it.
    // If any user of this function does not immediately construct the result they need to
    // verify that the result is a constructor.
    return constructor;
}

@globalPrivate
function typedArrayClampArgumentToStartOrEnd(value, length, undefinedValue)
{
    "use strict";

    if (value === @undefined)
        return undefinedValue;

    var int = @toInteger(value);
    if (int < 0) {
        int += length;
        return int < 0 ? 0 : int;
    }
    return int > length ? length : int;
}

function every(callback /*, thisArg */)
{
    "use strict";
    var length = @typedArrayLength(this);
    var thisArg = @argument(1);

    if (!@isCallable(callback))
        @throwTypeError("TypedArray.prototype.every callback must be a function");

    for (var i = 0; i < length; i++) {
        if (!callback.@call(thisArg, this[i], i, this))
            return false;
    }

    return true;
}

function fill(value /* [, start [, end]] */)
{
    "use strict";

    var length = @typedArrayLength(this);

    var number = @toNumber(value);

    var start = @typedArrayClampArgumentToStartOrEnd(@argument(1), length, 0);
    var end = @typedArrayClampArgumentToStartOrEnd(@argument(2), length, length);

    if (@isNeutered(this))
        @throwTypeError("Underlying ArrayBuffer has been detached from the view");

    for (var i = start; i < end; i++)
        this[i] = number;
    return this;
}

function find(callback /* [, thisArg] */)
{
    "use strict";
    var length = @typedArrayLength(this);
    var thisArg = @argument(1);

    if (!@isCallable(callback))
        @throwTypeError("TypedArray.prototype.find callback must be a function");

    for (var i = 0; i < length; i++) {
        var elem = this[i];
        if (callback.@call(thisArg, elem, i, this))
            return elem;
    }
    return @undefined;
}

function findIndex(callback /* [, thisArg] */)
{
    "use strict";
    var length = @typedArrayLength(this);
    var thisArg = @argument(1);

    if (!@isCallable(callback))
        @throwTypeError("TypedArray.prototype.findIndex callback must be a function");

    for (var i = 0; i < length; i++) {
        if (callback.@call(thisArg, this[i], i, this))
            return i;
    }
    return -1;
}

function forEach(callback /* [, thisArg] */)
{
    "use strict";
    var length = @typedArrayLength(this);
    var thisArg = @argument(1);

    if (!@isCallable(callback))
        @throwTypeError("TypedArray.prototype.forEach callback must be a function");

    for (var i = 0; i < length; i++)
        callback.@call(thisArg, this[i], i, this);
}

function some(callback /* [, thisArg] */)
{
    // 22.2.3.24
    "use strict";
    var length = @typedArrayLength(this);
    var thisArg = @argument(1);

    if (!@isCallable(callback))
        @throwTypeError("TypedArray.prototype.some callback must be a function");

    for (var i = 0; i < length; i++) {
        if (callback.@call(thisArg, this[i], i, this))
            return true;
    }

    return false;
}

@globalPrivate
function typedArrayElementCompare(array, a, b, comparator)
{
    "use strict";

    var result = @toNumber(comparator(a, b));

    if (@isNeutered(array))
        @throwTypeError("Underlying ArrayBuffer has been detached from the view");

    return result;
}

@globalPrivate
function typedArrayMerge(array, dst, src, srcIndex, srcEnd, width, comparator)
{
    "use strict";

    var left = srcIndex;
    var leftEnd = @min(left + width, srcEnd);
    var right = leftEnd;
    var rightEnd = @min(right + width, srcEnd);

    for (var dstIndex = left; dstIndex < rightEnd; ++dstIndex) {
        if (right < rightEnd) {
            if (left >= leftEnd || @typedArrayElementCompare(array, src[right], src[left], comparator) < 0) {
                dst[dstIndex] = src[right++];
                continue;
            }
        }

        dst[dstIndex] = src[left++];
    }
}

@globalPrivate
function typedArrayMergeSort(array, valueCount, comparator)
{
    "use strict";

    var buffer = @newArrayWithSize(valueCount);
    var dst = buffer;
    var src = array;

    for (var width = 1; width < valueCount; width *= 2) {
        for (var srcIndex = 0; srcIndex < valueCount; srcIndex += 2 * width)
            @typedArrayMerge(array, dst, src, srcIndex, valueCount, width, comparator);

        var tmp = src;
        src = dst;
        dst = tmp;
    }

    if (src != array) {
        for (var i = 0; i < valueCount; ++i)
            array[i] = src[i];
    }
}

function sort(comparator)
{
    "use strict";

    if (comparator !== @undefined && !@isCallable(comparator))
        @throwTypeError("TypedArray.prototype.sort requires the comparator argument to be a function or undefined");

    var length = @typedArrayLength(this);
    if (length < 2)
        return;

    if (comparator !== @undefined)
        @typedArrayMergeSort(this, length, comparator);
    else
        @typedArraySort(this);

    return this;
}

function subarray(begin, end)
{
    "use strict";

    if (!@isTypedArrayView(this))
        @throwTypeError("|this| should be a typed array view");

    var start = @toInteger(begin);
    var finish;
    if (end !== @undefined)
        finish = @toInteger(end);

    var constructor = @typedArraySpeciesConstructor(this);

    return @typedArraySubarrayCreate.@call(this, start, finish, constructor);
}

function reduce(callback /* [, initialValue] */)
{
    // 22.2.3.19
    "use strict";

    var length = @typedArrayLength(this);

    if (!@isCallable(callback))
        @throwTypeError("TypedArray.prototype.reduce callback must be a function");

    var argumentCount = @argumentCount();
    if (length === 0 && argumentCount < 2)
        @throwTypeError("TypedArray.prototype.reduce of empty array with no initial value");

    var accumulator, k = 0;
    if (argumentCount > 1)
        accumulator = @argument(1);
    else
        accumulator = this[k++];

    for (; k < length; k++)
        accumulator = callback.@call(@undefined, accumulator, this[k], k, this);

    return accumulator;
}

function reduceRight(callback /* [, initialValue] */)
{
    // 22.2.3.20
    "use strict";

    var length = @typedArrayLength(this);

    if (!@isCallable(callback))
        @throwTypeError("TypedArray.prototype.reduceRight callback must be a function");

    var argumentCount = @argumentCount();
    if (length === 0 && argumentCount < 2)
        @throwTypeError("TypedArray.prototype.reduceRight of empty array with no initial value");

    var accumulator, k = length - 1;
    if (argumentCount > 1)
        accumulator = @argument(1);
    else
        accumulator = this[k--];

    for (; k >= 0; k--)
        accumulator = callback.@call(@undefined, accumulator, this[k], k, this);

    return accumulator;
}

function map(callback /*, thisArg */)
{
    // 22.2.3.18
    "use strict";

    var length = @typedArrayLength(this);

    if (!@isCallable(callback))
        @throwTypeError("TypedArray.prototype.map callback must be a function");

    var thisArg = @argument(1);

    var constructor = @typedArraySpeciesConstructor(this);
    var result = new constructor(length);
    if (@typedArrayLength(result) < length)
        @throwTypeError("TypedArray.prototype.map constructed typed array of insufficient length");

    for (var i = 0; i < length; i++) {
        var mappedValue = callback.@call(thisArg, this[i], i, this);
        result[i] = mappedValue;
    }
    return result;
}

function filter(callback /*, thisArg */)
{
    "use strict";

    var length = @typedArrayLength(this);

    if (!@isCallable(callback))
        @throwTypeError("TypedArray.prototype.filter callback must be a function");

    var thisArg = @argument(1);
    var kept = [];

    for (var i = 0; i < length; i++) {
        var value = this[i];
        if (callback.@call(thisArg, value, i, this))
            @arrayPush(kept, value);
    }
    var length = kept.length;

    var constructor = @typedArraySpeciesConstructor(this);
    var result = new constructor(length);
    if (@typedArrayLength(result) < length)
        @throwTypeError("TypedArray.prototype.filter constructed typed array of insufficient length");

    for (var i = 0; i < length; i++)
        result[i] = kept[i];

    return result;
}

function toLocaleString(/* locale, options */)
{
    "use strict";

    var length = @typedArrayLength(this);

    if (length == 0)
        return "";

    var string = @toString(this[0].toLocaleString(@argument(0), @argument(1)));
    for (var i = 1; i < length; i++)
        string += "," + @toString(this[i].toLocaleString(@argument(0), @argument(1)));

    return string;
}

function at(index)
{
    "use strict";

    var length = @typedArrayLength(this);

    var k = @toInteger(index);
    if (k < 0)
        k += length;

    return (k >= 0 && k < length) ? this[k] : @undefined;
}
