const std = @import("std");
const utils = @import("types.zig");
const ArrayList = std.ArrayList;
const RndGen = std.rand.DefaultPrng;

const allocator = utils.allocator;

pub const Parameters = extern struct {
    gain: f32,
};

pub extern fn getRand() f32;

// EXPORTS
export fn process(left: *[128]f32, right: *[128]f32, params: *Parameters) [*][*]f32 {
    var channels = allocator.alloc([*]f32, 2) catch unreachable;
    var leftOutput = allocator.alloc(f32, 128) catch unreachable;
    var rightOutput = allocator.alloc(f32, 128) catch unreachable;

    const gain = params.gain;
    for (0..2) |i| {
        const currentInputChannel = switch (i) {
            0 => left,
            1 => right,
            else => right,
        };
        const currentOutputChannel = switch (i) {
            0 => leftOutput,
            1 => rightOutput,
            else => rightOutput,
        };
        for (0..128) |j| {
            var sample = currentInputChannel[j];
            const delta = 2 * (getRand() - 0.5);
            sample = sample + delta * gain;

            if (sample > 1.0) {
                sample = 1.0;
            } else if (sample < -1.0) {
                sample = -1.0;
            }

            currentOutputChannel[j] = sample;
        }
    }

    channels[0] = leftOutput.ptr;
    channels[1] = rightOutput.ptr;

    return channels.ptr;
}
